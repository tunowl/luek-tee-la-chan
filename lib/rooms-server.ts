import "server-only";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase-server";
import { FN, T } from "./db-names";
import { GameError, type Pools, type QRef } from "./engine";
import { viewAny, type AnyState } from "./games";

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // ห้องที่ไม่ขยับเกิน 1 วันถือว่าหมดอายุ
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 ตัว ตัด 0/O, 1/I/L ที่สับสนง่าย
export const CODE_LEN = 6;

// สุ่มแบบไม่เอนเอียง (rejection sampling)
export function newRoomCode(): string {
  let out = "";
  while (out.length < CODE_LEN) {
    for (const b of randomBytes(16)) {
      if (b < 248 && out.length < CODE_LEN) out += ALPH[b % ALPH.length]; // 248 = 31*8
    }
  }
  return out;
}
export const newId = () => randomBytes(9).toString("base64url");
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw new GameError("ใส่ชื่อก่อนเข้าห้อง");
  const s = raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) throw new GameError("ใส่ชื่อก่อนเข้าห้อง");
  if ([...s].length > 20) throw new GameError("ชื่อยาวได้ไม่เกิน 20 ตัวอักษร");
  return s;
}
export function cleanCode(raw: string): string {
  const c = String(raw || "").toUpperCase();
  if (!new RegExp(`^[${ALPH}]{${CODE_LEN}}$`).test(c)) throw new GameError("ไม่พบห้องนี้");
  return c;
}

// คำถามจาก Supabase แคช 5 นาที
let poolCache: { at: number; pools: Pools } | null = null;
export async function loadPools(): Promise<Pools> {
  if (poolCache && Date.now() - poolCache.at < 5 * 60_000) return poolCache.pools;
  const q = () => supabaseAdmin().from(T.questions);
  type Row = { id: number; level: number; rope: number; spicy?: boolean };
  let { data, error } = await q().select("id, level, rope, spicy").eq("active", true);
  // ยังไม่ได้รัน supabase/spicy.sql (ไม่มีคอลัมน์ spicy) ก็ยังเล่นได้ตามปกติ
  if (error && error.code === "42703") {
    const old = await q().select("id, level, rope").eq("active", true);
    data = old.data as Row[] | null;
    error = old.error;
  }
  if (error) throw error;
  const pools: Pools = [[], [], []];
  for (const r of (data ?? []) as Row[]) {
    if (r.level >= 0 && r.level <= 2) pools[r.level].push(r.spicy ? { id: r.id, rope: r.rope, sp: true } : { id: r.id, rope: r.rope });
  }
  if (pools.some((p) => !p.some((x) => !x.sp))) throw new Error("questions table is missing a level");
  poolCache = { at: Date.now(), pools };
  return pools;
}

type RoomRow = { state: AnyState; version: number };
export async function getRoom(code: string): Promise<RoomRow> {
  const { data, error } = await supabaseAdmin().from(T.rooms).select("state, version, updated_at").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data || Date.now() - new Date(data.updated_at as string).getTime() > ROOM_TTL_MS) throw new GameError("ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว");
  return { state: data.state as AnyState, version: data.version as number };
}

export async function playerFromToken(code: string, token: string | undefined): Promise<string> {
  if (!token || token.length < 30 || token.length > 100) throw new GameError("UNAUTHORIZED");
  const { data, error } = await supabaseAdmin()
    .from(T.roomPlayers)
    .select("player_id")
    .eq("room_code", code)
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new GameError("UNAUTHORIZED");
  return data.player_id as string;
}

export async function createRoom(code: string, state: AnyState, playerId: string, tokenHash: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc(FN.createRoom, {
    p_code: code, p_state: state, p_view: viewAny(state), p_player_id: playerId, p_token_hash: tokenHash,
  });
  if (error) throw error;
  return data === true;
}

// อัปเดตแบบตรวจเวอร์ชัน ลองใหม่สูงสุด 5 ครั้งถ้ามีคนเขียนแทรก
export async function mutateRoom(
  code: string,
  fn: (s: AnyState) => AnyState,
  extra: { addPlayer?: { id: string; tokenHash: string } } = {}
): Promise<{ state: AnyState; version: number }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, version } = await getRoom(code);
    const next = fn(state);
    const nextIds = new Set((next.players as { id: string }[]).map((p) => p.id));
    const removed = (state.players as { id: string }[]).map((p) => p.id).filter((id) => !nextIds.has(id));
    const { data, error } = await supabaseAdmin().rpc(FN.commitRoom, {
      p_code: code,
      p_expected: version,
      p_state: next,
      p_view: viewAny(next),
      p_add_player: extra.addPlayer?.id ?? null,
      p_add_hash: extra.addPlayer?.tokenHash ?? null,
      p_remove_players: removed.length ? removed : null,
    });
    if (error) throw error;
    if (typeof data === "number") return { state: next, version: data };
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new GameError("ห้องกำลังยุ่ง ลองกดอีกครั้ง");
}
