"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { T } from "@/lib/db-names";
import { CODE_RE, lastName, saveName } from "@/lib/ui";
import { loadQuestionTexts } from "@/lib/questions-client";
import { GAMES, gameOf, type AnyAction, type AnyPrivate, type AnyView } from "@/lib/games";
import type { GameView } from "@/lib/engine";
import type { WolfView } from "@/lib/wolf";
import type { LetterView } from "@/lib/letter";
import type { SpyView } from "@/lib/spy";
import LthPlay, { SpicyToggle } from "./LthPlay";
import WolfPlay, { WolfLobby } from "./WolfPlay";
import LetterPlay, { LetterLobby } from "./LetterPlay";
import SpyPlay, { SpyLobby } from "./SpyPlay";
import type { Ctx } from "./shared";

type Room = { view: AnyView; version: number };
type Me = { playerId: string; priv: AnyPrivate; version: number };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
const post = (url: string, body: unknown) =>
  api<Record<string, unknown>>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// สีพื้นหลังของหน้า (ใช้ธีม 3 ระดับที่มีอยู่แล้ว)
function themeFor(v: AnyView | null): string {
  if (!v || v.phase === "lobby") return "1";
  if (v.game === "wolf") return v.phase === "night" ? "3" : v.phase === "day" ? "1" : "2";
  if (v.game === "letter" || v.game === "spy") return "2";
  return String((v as GameView).level + 1);
}

export default function Game({ code }: { code: string }) {
  const router = useRouter();
  const validCode = CODE_RE.test(code);
  const [room, setRoom] = useState<Room | null>(null);
  const [missing, setMissing] = useState(!validCode);
  const [me, setMe] = useState<Me | null>(null);
  const [meState, setMeState] = useState<"unknown" | "in" | "out">("unknown");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const versionRef = useRef(0);
  const meVersion = useRef(0);
  const meInflight = useRef<number | null>(null);

  const accept = useCallback((r: Room) => {
    if (r.version >= versionRef.current) {
      versionRef.current = r.version;
      // ห้องเก่าที่สร้างก่อนมีหลายเกมไม่มีช่อง game
      setRoom({ ...r, view: { ...r.view, game: gameOf(r.view as { game?: "lth" }) } as AnyView });
    }
  }, []);

  const fetchView = useCallback(async () => {
    const { data, error } = await supabaseBrowser().from(T.roomViews).select("view, version").eq("code", code).maybeSingle();
    if (error) return;
    if (!data) return setMissing(true);
    setMissing(false);
    accept({ view: data.view as AnyView, version: data.version as number });
  }, [code, accept]);

  // รับข้อมูลลับเฉพาะเวอร์ชันที่ใหม่กว่าเดิม กันคำตอบที่มาช้าเขียนทับของใหม่
  const acceptMe = useCallback((m: Me) => {
    if (m.version >= meVersion.current) {
      meVersion.current = m.version;
      setMe(m);
      setMeState("in");
    }
  }, []);

  const fetchMe = useCallback(async () => {
    const r = await api<Me>(`/api/rooms/${code}/me`);
    if (r.ok) acceptMe(r.data);
    else if (r.status === 401 || r.status === 400) { meVersion.current = 0; setMe(null); setMeState("out"); }
  }, [code, acceptMe]);

  useEffect(() => {
    setName(lastName());
    if (!validCode) return;
    fetchView();
    fetchMe();
  }, [validCode, fetchView, fetchMe]);

  // Realtime: มุมมองสาธารณะของห้อง + ใครออนไลน์
  const myId = me?.playerId ?? null;
  const myName = useMemo(() => room?.view.players.find((p) => p.id === myId)?.name ?? "", [room, myId]);
  useEffect(() => {
    if (!validCode) return;
    const sb = supabaseBrowser();
    const key = myId ?? `guest-${crypto.randomUUID()}`;
    const ch: RealtimeChannel = sb.channel(`room-${code}`, { config: { presence: { key } } });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: T.roomViews, filter: `code=eq.${code}` }, (payload) => {
      const n = payload.new as { view: AnyView; version: number };
      if (n && n.view) accept({ view: n.view, version: n.version });
    })
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (myId) ch.track({ at: Date.now() });
          fetchView();
        }
      });
    const poll = setInterval(fetchView, 60000); // สำรองเผื่อ Realtime หลุด ปกติไม่จำเป็น
    const onVis = () => document.visibilityState === "visible" && fetchView();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      sb.removeChannel(ch);
    };
  }, [validCode, code, myId, fetchView, accept]);

  // ห้องเปลี่ยนเวอร์ชันเมื่อไหร่ ดึงข้อมูลลับของเราใหม่ทันที (ไม่ยิงซ้ำถ้ากำลังดึงเวอร์ชันนี้อยู่)
  useEffect(() => {
    if (meState !== "in" || !room || meVersion.current >= room.version) return;
    if (meInflight.current !== null && meInflight.current >= room.version) return;
    meInflight.current = room.version;
    fetchMe().finally(() => { if (meInflight.current === room.version) meInflight.current = null; });
  }, [room?.version, meState]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = room?.view ?? null;
  const myI = v && myId ? v.players.findIndex((p) => p.id === myId) : -1;
  const isHost = !!(v && myId && v.hostId === myId);
  const theme = themeFor(v);
  // โหลดข้อความคำถามไว้ล่วงหน้าตั้งแต่อยู่ห้องรอ การ์ดจะขึ้นทันทีตอนเริ่มเกม
  const isLth = v?.game === "lth";
  useEffect(() => { if (isLth) loadQuestionTexts().catch(() => {}); }, [isLth]);
  useEffect(() => { document.body.dataset.level = theme; }, [theme]);

  async function send(action: AnyAction) {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await post(`/api/rooms/${code}/action`, { action }).catch(() => null);
    setBusy(false);
    if (!r) return setErr("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    if (!r.ok) {
      setErr(r.data.error || "ส่งไม่สำเร็จ ลองอีกครั้ง");
      if (r.status === 401) { meVersion.current = 0; setMe(null); setMeState("out"); }
      fetchMe();
      return;
    }
    // ใช้ผลที่เซิร์ฟเวอร์ส่งกลับมาเลย ไม่ต้องรอ Realtime
    const d = r.data as { version?: number; view?: AnyView; priv?: AnyPrivate };
    if (typeof d.version === "number" && d.view && d.priv && myId) {
      accept({ view: d.view, version: d.version });
      acceptMe({ playerId: myId, priv: d.priv, version: d.version });
    } else {
      fetchView();
      fetchMe();
    }
  }

  async function join() {
    setErr("");
    if (!name.trim()) return setErr("ใส่ชื่อก่อนเข้าห้อง");
    setBusy(true);
    const r = await post(`/api/rooms/${code}/join`, { name }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) return setErr(r?.data.error || "เข้าห้องไม่สำเร็จ");
    saveName(name.trim());
    await fetchMe();
    fetchView();
  }

  async function leave() {
    await post(`/api/rooms/${code}/leave`, {}).catch(() => null);
    router.push("/");
  }

  const errNote = err ? <p className="note" role="alert">{err}</p> : null;

  /* ---------- screens ---------- */
  if (missing) {
    return (
      <main className="wrap"><div className="handoff center">
        <h1 style={{ fontSize: 28 }}>ไม่พบห้อง {code}</h1>
        <p className="muted" style={{ margin: "10px 0 24px" }}>ตรวจรหัสห้องอีกครั้ง ห้องที่ไม่มีความเคลื่อนไหวเกิน 1 วันจะถูกลบอัตโนมัติ</p>
        <Link className="btn ghost" href="/">กลับหน้าแรก</Link>
      </div></main>
    );
  }
  if (!v || meState === "unknown") {
    return <main className="wrap"><div className="handoff center"><h1 style={{ fontSize: 28 }}>กำลังเข้าห้อง…</h1></div></main>;
  }

  const G = GAMES[v.game];

  if (meState === "out" || myI < 0 || !me || !myId) {
    const full = v.players.length >= G.max;
    return (
      <main className="wrap">
        <div className="bar"><Link className="link" href="/">กลับ</Link><span className="small muted">ห้อง {code} · {G.name}</span></div>
        <h1 style={{ fontSize: 32 }}>เข้าห้อง {code}</h1>
        <p className="muted" style={{ margin: "6px 0 18px" }}>เกม{G.name} · ในห้องตอนนี้: {v.players.map((p) => p.name).join(", ")}</p>
        {v.game !== "lth" && v.phase !== "lobby" && !v.locked && !full && (
          <p className="muted small" style={{ marginBottom: 12 }}>เกมกำลังเล่นอยู่ เข้าไปแล้วจะได้ร่วมเล่นตั้งแต่{v.game === "wolf" ? "เกม" : "รอบ"}ถัดไป</p>
        )}
        {v.locked || full ? (
          <p className="note">{v.locked ? "เจ้าของห้องปิดรับคนเพิ่มแล้ว" : `ห้องนี้เต็มแล้ว (${G.max} คน)`}</p>
        ) : (
          <div className="stack">
            <div>
              <label className="lb" htmlFor="jn">ชื่อของคุณในวง</label>
              <input className="txt" id="jn" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()} />
            </div>
            <button className="btn" onClick={join} disabled={busy}>{busy ? "กำลังเข้าห้อง…" : "เข้าห้อง"}</button>
          </div>
        )}
        {errNote}
      </main>
    );
  }

  const bar = (label: React.ReactNode) => (
    <div className="bar">
      <span className="lvl">{label}</span>
      <span className="small muted">ห้อง {code} · {myName} &nbsp;<button className="link" onClick={leave}>ออกจากห้อง</button></span>
    </div>
  );
  const ctx: Ctx = { code, myId, myI, isHost, busy, online, send, bar, errNote };

  if (v.phase === "lobby") {
    const link = typeof window !== "undefined" ? window.location.href : "";
    const kickBtn = (j: number) =>
      isHost && v.players[j].id !== v.hostId ? (
        <button className="link" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ type: "kick", player: j })}>เชิญออก</button>
      ) : null;
    const enough = v.players.length >= G.min;
    const short = G.min - v.players.length;
    return (
      <main className="wrap">
        {bar(`${G.name} · ห้องรอเริ่ม`)}
        <p className="muted">รหัสห้อง</p>
        <p className="code">{code}</p>
        <p className="muted small">ส่งลิงก์นี้ให้เพื่อน หรือบอกรหัสห้อง เล่นได้ {G.players}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="txt" readOnly value={link} aria-label="ลิงก์ห้อง" onFocus={(e) => e.target.select()} />
          <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(link)}>คัดลอก</button>
        </div>
        <div className="plist">
          {v.players.map((p, j) => (
            <div className="pl" key={p.id}>
              <span className={`dot ${online.has(p.id) ? "" : "off"}`} />{p.name}
              {p.id === v.hostId && <span className="tag">{v.game === "wolf" ? "ผู้ดำเนินเกม" : "เจ้าของห้อง"}</span>}
              {p.id === myId && <span className="tag">คุณ</span>}
              {kickBtn(j)}
            </div>
          ))}
        </div>
        {v.game === "wolf" && <WolfLobby ctx={ctx} v={v} />}
        {v.game === "letter" && <LetterLobby v={v} />}
        {v.game === "lth" && <SpicyToggle ctx={ctx} on={(v as GameView).spicy} />}
        {v.game === "spy" && <SpyLobby ctx={ctx} v={v} />}
        {isHost && (
          <label className="toggle"><input type="checkbox" checked={v.locked} onChange={() => send({ type: "lock", locked: !v.locked })} />
            <span>ปิดรับคนเข้าห้องเพิ่ม</span></label>
        )}
        <div style={{ marginTop: 26 }}>
          {isHost ? (
            <button className="btn" onClick={() => send({ type: "start" })} disabled={busy || !enough}>
              {enough ? "เริ่มเกม" : `รอเพื่อนอีกอย่างน้อย ${short} คน`}
            </button>
          ) : <p className="center muted">รอเจ้าของห้องเริ่มเกม</p>}
        </div>
        {errNote}
      </main>
    );
  }

  if (v.game === "wolf") return <WolfPlay ctx={ctx} v={v as WolfView} priv={me.priv.game === "wolf" ? me.priv.me : { kind: "none" }} />;
  if (v.game === "spy") return <SpyPlay ctx={ctx} v={v as SpyView} priv={me.priv.game === "spy" ? me.priv.me : { kind: "none" }} />;
  if (v.game === "letter") return <LetterPlay ctx={ctx} v={v as LetterView} priv={me.priv.game === "letter" ? me.priv : { hand: [], notes: [] }} />;
  return <LthPlay ctx={ctx} v={v as GameView} hand={me.priv.game === "lth" ? me.priv.hand : []} />;
}
