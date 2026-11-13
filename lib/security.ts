import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase-server";
import { FN } from "./db-names";
import { GameError } from "./engine";
import type { AnyAction } from "./games";

const MAX_BODY_BYTES = 2048;
export const COOKIE = "lth_t";

/* ---------- ตอบกลับ ---------- */
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function fail(e: unknown) {
  if (e instanceof GameError) {
    if (e.message === "UNAUTHORIZED") return json({ error: "ไม่พบข้อมูลผู้เล่นของคุณในห้องนี้ กรุณาเข้าห้องใหม่" }, 401);
    if (e.message === "RATE_LIMITED") return json({ error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่" }, 429);
    if (e.message === "FORBIDDEN") return json({ error: "คำขอไม่ได้มาจากหน้าเว็บนี้" }, 403);
    return json({ error: e.message }, 400);
  }
  console.error("[api]", e instanceof Error ? e.message : e);
  return json({ error: "เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง" }, 500);
}

/* ---------- กัน CSRF: คำขอที่เปลี่ยนข้อมูลต้องมาจากโดเมนเดียวกัน ---------- */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new GameError("FORBIDDEN");
  let o: URL;
  try { o = new URL(origin); } catch { throw new GameError("FORBIDDEN"); }
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (o.host !== host && !allowed.includes(o.origin)) throw new GameError("FORBIDDEN");
  if (req.headers.get("sec-fetch-site") && !["same-origin", "none"].includes(req.headers.get("sec-fetch-site")!)) {
    if (!allowed.includes(o.origin)) throw new GameError("FORBIDDEN");
  }
}

/* ---------- อ่าน body แบบจำกัดขนาด ---------- */
export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new GameError("คำขอไม่ถูกต้อง");
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) throw new GameError("คำขอใหญ่เกินไป");
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new GameError("คำขอใหญ่เกินไป");
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw 0;
    return v as Record<string, unknown>;
  } catch {
    throw new GameError("คำขอไม่ถูกต้อง");
  }
}

/* ---------- rate limit (เก็บใน Postgres ใช้ได้ข้าม serverless instance) ---------- */
export function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf ? xf.split(",")[0] : req.headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
}
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await supabaseAdmin().rpc(FN.rateLimitHit, { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw error;
  if (data !== true) throw new GameError("RATE_LIMITED");
}

/* ---------- cookie token: httpOnly อ่านจาก JavaScript ไม่ได้ ---------- */
export function setTokenCookie(res: NextResponse, code: string, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: `/api/rooms/${code}`,
    maxAge: 60 * 60 * 24 * 2,
  });
}
export function clearTokenCookie(res: NextResponse, code: string) {
  res.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: `/api/rooms/${code}`, maxAge: 0 });
}

/* ---------- ตรวจรูปแบบ action อย่างเข้มงวด ---------- */
const int = (v: unknown, max: number): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) throw new GameError("คำขอไม่ถูกต้อง");
  return v;
};
const bool = (v: unknown): boolean => {
  if (v === undefined) return false;
  if (typeof v !== "boolean") throw new GameError("คำขอไม่ถูกต้อง");
  return v;
};
const pid = (v: unknown): string => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{12}$/.test(v)) throw new GameError("คำขอไม่ถูกต้อง");
  return v;
};
const pidOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : pid(v));
const intOrNull = (v: unknown, max: number): number | null => (v === null || v === undefined ? null : int(v, max));

// รูปแบบของทุกเกมรวมกัน แต่ละเกมตรวจอีกชั้นว่าเป็นการกระทำของเกมตัวเองหรือไม่
export function parseAction(raw: unknown): AnyAction {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new GameError("คำขอไม่ถูกต้อง");
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case "start": case "answer": case "pass": case "skip": case "deeper": case "next": case "again":
    case "dawn": case "reset": case "timeup": case "reveal":
      return { type: a.type };
    case "ask": {
      if (!Array.isArray(a.targets) || a.targets.length > 6) throw new GameError("คำขอไม่ถูกต้อง");
      return { type: "ask", handIndex: int(a.handIndex, 20), cardId: int(a.cardId, 10_000_000), targets: a.targets.map((t) => int(t, 5)), useDouble: bool(a.useDouble), useAll: bool(a.useAll) };
    }
    case "buddy": return { type: "buddy", to: int(a.to, 5) };
    case "kick": return { type: "kick", player: int(a.player, 15) };
    case "lock": return { type: "lock", locked: bool(a.locked) };
    case "spicy": return { type: "spicy", on: bool(a.on) };
    /* มนุษย์หมาป่า */
    case "settings":
      return { type: "settings", auto: bool(a.auto), wolves: Math.max(1, int(a.wolves, 5)), seer: bool(a.seer), doctor: bool(a.doctor), hunter: bool(a.hunter) };
    case "night": {
      if (a.step !== "kill" && a.step !== "save" && a.step !== "check") throw new GameError("คำขอไม่ถูกต้อง");
      return { type: "night", step: a.step, target: pidOrNull(a.target) };
    }
    case "vote": return { type: "vote", target: pidOrNull(a.target) };
    case "execute": return { type: "execute", target: pidOrNull(a.target) };
    case "mark": return { type: "mark", target: pid(a.target), alive: bool(a.alive) };
    /* จดหมายลับ */
    case "play": return { type: "play", card: int(a.card, 9), target: pidOrNull(a.target), guess: intOrNull(a.guess, 9) };
    case "keep": return { type: "keep", card: int(a.card, 9) };
    /* สายลับในวง (vote ใช้ร่วมกับมนุษย์หมาป่า) */
    case "minutes": return { type: "minutes", minutes: int(a.minutes, 15) };
    case "accuse": return { type: "accuse", target: pid(a.target) };
    case "verdict": return { type: "verdict", yes: bool(a.yes) };
    case "guess": return { type: "guess", location: int(a.location, 50) };
    default: throw new GameError("คำขอไม่ถูกต้อง");
  }
}

/* ---------- เปรียบเทียบ secret แบบเวลาคงที่ ---------- */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
