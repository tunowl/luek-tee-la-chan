"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { T } from "@/lib/db-names";
import { loadQuestionTexts } from "@/lib/questions-client";
import { CODE_RE, LEVELS, ROPES, lastName, saveName } from "@/lib/ui";
import { MAX_PLAYERS, NEED_FRONT, SPECIALS, tableRopes, type Action, type Card, type GameEvent, type GameView, type QCard } from "@/lib/engine";

const cssVar = (k: string, v: string) => ({ [k]: v }) as React.CSSProperties;
type Room = { view: GameView; version: number };
type Me = { playerId: string; hand: Card[]; version: number };
type Sel = { hi: number | null; targets: number[]; dbl: boolean; all: boolean };
const emptySel: Sel = { hi: null, targets: [], dbl: false, all: false };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
const post = (url: string, body: unknown) =>
  api<Record<string, unknown>>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function Game({ code }: { code: string }) {
  const router = useRouter();
  const validCode = CODE_RE.test(code);
  const [room, setRoom] = useState<Room | null>(null);
  const [missing, setMissing] = useState(!validCode);
  const [me, setMe] = useState<Me | null>(null);
  const [meState, setMeState] = useState<"unknown" | "in" | "out">("unknown");
  const [texts, setTexts] = useState<Map<number, string>>(new Map());
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Sel>(emptySel);
  const [budPick, setBudPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<GameEvent | null>(null);
  const [name, setName] = useState("");
  const seenSeq = useRef<number | null>(null);
  const versionRef = useRef(0);
  const meTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accept = useCallback((r: Room) => {
    if (r.version >= versionRef.current) {
      versionRef.current = r.version;
      setRoom(r);
    }
  }, []);

  const fetchView = useCallback(async () => {
    const { data, error } = await supabaseBrowser().from(T.roomViews).select("view, version").eq("code", code).maybeSingle();
    if (error) return;
    if (!data) return setMissing(true);
    setMissing(false);
    accept({ view: data.view as GameView, version: data.version as number });
  }, [code, accept]);

  const fetchMe = useCallback(async () => {
    const r = await api<Me>(`/api/rooms/${code}/me`);
    if (r.ok) { setMe(r.data); setMeState("in"); }
    else if (r.status === 401 || r.status === 400) { setMe(null); setMeState("out"); }
  }, [code]);

  useEffect(() => {
    setName(lastName());
    if (!validCode) return;
    fetchView();
    fetchMe();
    loadQuestionTexts().then(setTexts).catch(() => setErr("โหลดคำถามไม่สำเร็จ ลองรีเฟรชหน้า"));
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
      const n = payload.new as { view: GameView; version: number };
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

  // ห้องเปลี่ยนเวอร์ชันเมื่อไหร่ ดึงไพ่ในมือของเราใหม่
  useEffect(() => {
    if (meState !== "in" || !room || (me && me.version >= room.version)) return;
    if (meTimer.current) clearTimeout(meTimer.current);
    meTimer.current = setTimeout(fetchMe, 120);
  }, [room?.version, meState]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = room?.view ?? null;
  const myI = v && myId ? v.players.findIndex((p) => p.id === myId) : -1;
  const meP = v && myI > -1 ? v.players[myI] : null;
  const hand = me?.hand ?? [];
  const isHost = !!(v && myId && v.hostId === myId);

  useEffect(() => {
    document.body.dataset.level = String(v && v.phase !== "lobby" ? v.level + 1 : 1);
  }, [v?.level, v?.phase]);

  const turnKey = v ? `${v.phase}|${v.level}|${v.current}|${v.pending ? 1 : 0}` : "";
  useEffect(() => { setSel(emptySel); setBudPick(false); }, [turnKey]);

  useEffect(() => {
    if (!v) return;
    if (seenSeq.current === null) { seenSeq.current = v.eventSeq; return; }
    if (v.eventSeq > seenSeq.current) {
      const prev = seenSeq.current;
      seenSeq.current = v.eventSeq;
      const latest = [...v.events].reverse().find((e) => e.n > prev && e.type === "bonus");
      if (latest) {
        setToast(latest);
        const t = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(t);
      }
    }
  }, [v?.eventSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(action: Action) {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await post(`/api/rooms/${code}/action`, { action }).catch(() => null);
    setBusy(false);
    if (!r) return setErr("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    if (!r.ok) {
      setErr(r.data.error || "ส่งไม่สำเร็จ ลองอีกครั้ง");
      if (r.status === 401) { setMe(null); setMeState("out"); }
      fetchMe();
      return;
    }
    fetchView();
    fetchMe();
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

  const qText = (c: QCard) => texts.get(c.id) ?? "…";
  const ropes = useMemo(() => (v ? tableRopes(v) : new Set<number>()), [v]);
  const errNote = err ? <p className="note" role="alert">{err}</p> : null;
  const nameOf = (id: string) => v?.players.find((p) => p.id === id)?.name ?? "ใครสักคน";

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

  if (meState === "out" || myI < 0) {
    const full = v.players.length >= MAX_PLAYERS;
    return (
      <main className="wrap">
        <div className="bar"><Link className="link" href="/">กลับ</Link><span className="small muted">ห้อง {code}</span></div>
        <h1 style={{ fontSize: 32 }}>เข้าห้อง {code}</h1>
        <p className="muted" style={{ margin: "6px 0 18px" }}>ในห้องตอนนี้: {v.players.map((p) => p.name).join(", ")}</p>
        {v.locked || full ? (
          <p className="note">{v.locked ? "เจ้าของห้องปิดรับคนเพิ่มแล้ว" : "ห้องนี้เต็มแล้ว (6 คน)"}</p>
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

  const L = LEVELS[v.level];
  const bar = (
    <div className="bar">
      <span className="lvl">
        {v.phase === "lobby" ? "ห้องรอเริ่ม" : (<><span className="swatch" style={{ background: L.strip.replace("180deg", "90deg") }} />ชั้น{L.name}</>)}
      </span>
      <span className="small muted">ห้อง {code} · {myName} &nbsp;<button className="link" onClick={leave}>ออกจากห้อง</button></span>
    </div>
  );
  const kickBtn = (j: number) =>
    isHost && v.players[j].id !== v.hostId ? (
      <button className="link" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ type: "kick", player: j })}>เชิญออก</button>
    ) : null;

  if (v.phase === "lobby") {
    const link = typeof window !== "undefined" ? window.location.href : "";
    return (
      <main className="wrap">
        {bar}
        <p className="muted">รหัสห้อง</p>
        <p className="code">{code}</p>
        <p className="muted small">ส่งลิงก์นี้ให้เพื่อน หรือบอกรหัสห้อง เล่นได้ 2–6 คน</p>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="txt" readOnly value={link} aria-label="ลิงก์ห้อง" onFocus={(e) => e.target.select()} />
          <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(link)}>คัดลอก</button>
        </div>
        <div className="plist">
          {v.players.map((p, j) => (
            <div className="pl" key={p.id}>
              <span className={`dot ${online.has(p.id) ? "" : "off"}`} />{p.name}
              {p.id === v.hostId && <span className="tag">เจ้าของห้อง</span>}
              {p.id === myId && <span className="tag">คุณ</span>}
              {kickBtn(j)}
            </div>
          ))}
        </div>
        {isHost && (
          <label className="toggle"><input type="checkbox" checked={v.locked} onChange={() => send({ type: "lock", locked: !v.locked })} />
            <span>ปิดรับคนเข้าห้องเพิ่ม</span></label>
        )}
        <div style={{ marginTop: 26 }}>
          {isHost ? (
            <button className="btn" onClick={() => send({ type: "start" })} disabled={busy || v.players.length < 2}>
              {v.players.length < 2 ? "รอเพื่อนอีกอย่างน้อย 1 คน" : "เริ่มเกม"}
            </button>
          ) : <p className="center muted">รอเจ้าของห้องเริ่มเกม</p>}
        </div>
        {errNote}
      </main>
    );
  }

  if (v.phase === "up" || v.phase === "end") {
    const end = v.phase === "end";
    const next = LEVELS[Math.min(v.level + 1, 2)];
    const lastUp = [...v.events].reverse().find((e) => e.type === "levelup");
    const why = lastUp && lastUp.type === "levelup"
      ? lastUp.reason === "ropes" ? "เชือกครบ 6 สีแล้ว" : lastUp.reason === "front" ? "ทุกคนมีการ์ดตรงหน้าครบแล้ว" : "เจ้าของห้องพาวงไปต่อ"
      : "";
    return (
      <main className="wrap">
        {bar}
        <div className="handoff">
          <p className="muted">{why}</p>
          <h1 className="name">{end ? "ถึงก้นทะเลแล้ว" : `ดำลงสู่ชั้น${next.name}`}</h1>
          <p style={{ marginBottom: 26 }}>
            {end
              ? "จบรอบนี้แล้ว ลองบอกกันสักคำว่าคืนนี้ได้รู้อะไรใหม่เกี่ยวกับใคร"
              : `${next.desc} การ์ดคำถามในมือจะเปลี่ยนเป็นของชั้นใหม่ การ์ดพิเศษเก็บไว้ได้ และทุกคนได้การ์ดผ่านคืน 1 ใบ`}
          </p>
          {end
            ? isHost ? <button className="btn" onClick={() => send({ type: "again" })} disabled={busy}>เล่นอีกรอบ</button> : <p className="muted center">รอเจ้าของห้องเริ่มรอบใหม่</p>
            : <button className="btn" onClick={() => send({ type: "next" })} disabled={busy}>ดำลงไป</button>}
          {errNote}
        </div>
      </main>
    );
  }

  /* ---------- play ---------- */
  const q = v.pending;
  const cur = v.players[v.current];
  const ropeTag = (c: QCard) => (
    <span className="rope" style={cssVar("--rc", ROPES[c.rope].c)}><i />&nbsp;เชือก{ROPES[c.rope].n}{!ropes.has(c.rope) && " · สีใหม่"}</span>
  );
  const cardView = (c: Card, i: number, clickable: boolean) =>
    c.kind === "s" ? (
      <div className="card special" key={i}><b>{SPECIALS[c.s].name}</b><span>{SPECIALS[c.s].how}</span></div>
    ) : (
      <button key={i} className={`card ${sel.hi === i ? "picked" : ""}`} style={cssVar("--strip", LEVELS[c.lv].strip)}
        disabled={!clickable} aria-pressed={clickable ? sel.hi === i : undefined}
        onClick={() => clickable && setSel({ ...sel, hi: i })}>
        <span className="q">{qText(c)}</span>{ropeTag(c)}
      </button>
    );
  const hasSpecial = (s: "buddy" | "double" | "all") => hand.some((c) => c.kind === "s" && c.s === s);

  let main: React.ReactNode;
  if (q) {
    const asker = v.players[q.asker];
    const k = q.targets.indexOf(myI);
    const mine = k > -1 && !q.res[k];
    const canBud = !q.buddyUsed && hasSpecial("buddy") && v.players.length > q.targets.length;
    main = (
      <>
        <div className="card big" style={cssVar("--strip", LEVELS[q.card.lv].strip)}>
          <p className="meta">{asker?.name} ถาม{q.special === "all" ? "ทั้งวง" : ""}</p>
          <p className="q">{qText(q.card)}</p>
          {ropeTag(q.card)}
        </div>
        <div>
          {q.targets.map((t, m) => (
            <div className="who" key={t}>
              <span className="n">{v.players[t]?.name}{t === myI && <span className="tag"> คุณ</span>}</span>
              <span className="st">{q.res[m] === 1 ? "ตอบแล้ว" : q.res[m] === 2 ? "ผ่าน" : "กำลังตอบ…"}</span>
            </div>
          ))}
        </div>
        {mine && meP && (budPick ? (
          <div className="panel">
            <h3>ชวนใครมาตอบด้วย</h3>
            <div className="chips">
              {v.players.map((o, j) => q.targets.includes(j) ? null : (
                <button className="chip" key={o.id} onClick={() => { setBudPick(false); send({ type: "buddy", to: j }); }}>{o.name}</button>
              ))}
            </div>
            <button className="link" style={{ marginTop: 8 }} onClick={() => setBudPick(false)}>ยกเลิก</button>
          </div>
        ) : (
          <div className="myturn">
            <button className="btn" disabled={busy} onClick={() => send({ type: "answer" })}>ตอบเสร็จแล้ว</button>
            {meP.pass && <button className="btn ghost" disabled={busy} onClick={() => send({ type: "pass" })}>ใช้การ์ดผ่าน</button>}
            {canBud && <button className="btn ghost" disabled={busy} onClick={() => setBudPick(true)}>ใช้การ์ดชวนเพื่อน</button>}
          </div>
        ))}
      </>
    );
  } else if (v.current === myI) {
    const hasD = hasSpecial("double") && v.players.length >= 3;
    const hasA = hasSpecial("all");
    const need = sel.all ? 0 : sel.dbl ? 2 : 1;
    const picked = sel.hi !== null ? hand[sel.hi] : undefined;
    const ok = !!picked && picked.kind === "q" && (sel.all || sel.targets.length === need);
    const toggleTarget = (j: number) => {
      let t = sel.targets.includes(j) ? sel.targets.filter((x) => x !== j) : [...sel.targets, j];
      if (t.length > (sel.dbl ? 2 : 1)) t = t.slice(1);
      setSel({ ...sel, targets: t });
    };
    main = (
      <>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>ตาคุณแล้ว เลือกคำถามหนึ่งใบ</h2>
        <div className="hand">{hand.map((c, i) => cardView(c, i, true))}</div>
        {sel.hi !== null ? (
          <div className="panel">
            <h3>{sel.all ? "ทุกคนในวงจะตอบคำถามนี้" : sel.dbl ? "ถามใคร (เลือก 2 คน)" : "ถามใคร"}</h3>
            {!sel.all && (
              <>
                <div className="chips">
                  {v.players.map((o, j) => j === myI ? null : (
                    <button key={o.id} className={`chip ${sel.targets.includes(j) ? "on" : ""}`} onClick={() => toggleTarget(j)}>{o.name} · {o.front.length}</button>
                  ))}
                </div>
                <p className="muted small" style={{ marginTop: 8 }}>ตัวเลขคือจำนวนการ์ดที่อยู่ตรงหน้าแต่ละคนในชั้นนี้</p>
              </>
            )}
            {hasD && !sel.all && (
              <label className="toggle"><input type="checkbox" checked={sel.dbl} onChange={() => setSel({ ...sel, dbl: !sel.dbl, targets: sel.dbl ? sel.targets.slice(-1) : sel.targets })} />
                <span>ใช้การ์ด<b>เพิ่มคน</b> ถามสองคนพร้อมกัน</span></label>
            )}
            {hasA && (
              <label className="toggle"><input type="checkbox" checked={sel.all} onChange={() => setSel({ ...sel, all: !sel.all })} />
                <span>ใช้การ์ด<b>ทั้งวง</b> ให้ทุกคนตอบ รวมถึงคุณ</span></label>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn" disabled={!ok || busy}
                onClick={() => picked && picked.kind === "q" && send({ type: "ask", handIndex: sel.hi!, cardId: picked.id, targets: sel.targets, useDouble: sel.dbl, useAll: sel.all })}>
                {busy ? "กำลังส่ง…" : "ถามเลย"}
              </button>
            </div>
          </div>
        ) : <p className="muted small center" style={{ marginTop: 16 }}>แตะการ์ดคำถามที่อยากถาม</p>}
        <p className="center" style={{ marginTop: 14 }}><button className="link" disabled={busy} onClick={() => send({ type: "skip" })}>ข้ามตาตัวเอง</button></p>
      </>
    );
  } else {
    main = (
      <>
        <p style={{ fontFamily: "var(--display)", fontSize: 22, marginBottom: 6 }}>รอ{cur?.name}เลือกคำถาม</p>
        {cur && !online.has(cur.id) && <p className="muted small">{cur.name} ดูเหมือนจะหลุดจากห้อง{isHost ? " กดข้ามตาได้ด้านล่าง" : ""}</p>}
        <p className="muted small" style={{ margin: "14px 0 10px" }}>ไพ่ในมือคุณ · การ์ดผ่าน{meP?.pass ? "ยังมี 1 ใบ" : "ใช้แล้วในชั้นนี้"}</p>
        <div className="hand">{hand.map((c, i) => cardView(c, i, false))}</div>
      </>
    );
  }

  return (
    <main className="wrap">
      {bar}
      {toast && toast.type === "bonus" && (
        <div className="toast" role="status" style={cssVar("--rc", ROPES[toast.rope].c)}>
          <i />
          <span><b>{nameOf(toast.player)}</b> ได้เชือก{ROPES[toast.rope].n}เป็นสีใหม่ของวง รับการ์ด<b>{SPECIALS[toast.special].name}</b>เพิ่ม 1 ใบ</span>
        </div>
      )}
      <div className="ropes">
        <div className="knots" aria-label={`เชือกที่วงมีแล้ว ${ropes.size} จาก 6 สี`}>
          {ROPES.map((r, i) => <span key={r.n} title={r.n} className={`knot ${ropes.has(i) ? "on" : ""}`} style={cssVar("--k", r.c)} />)}
        </div>
        <p>สีใหม่ได้การ์ดพิเศษ 1 ใบ · ครบ 6 สี หรือทุกคนมีการ์ดตรงหน้า {NEED_FRONT} ใบ จะดำลงชั้นถัดไป</p>
      </div>
      <div className="seats">
        {v.players.map((p, i) => (
          <div className={`seat ${i === v.current && !q ? "turn" : ""}`} key={p.id}>
            <span className="nm"><span className={`dot ${online.has(p.id) ? "" : "off"}`} />{p.name}{p.id === myId && <span className="tag">คุณ</span>}</span>
            <span className="fr">
              {p.front.map((c, k) => <i key={k} style={{ background: ROPES[c.rope].c }} title={`เชือก${ROPES[c.rope].n}`} />)}
              {Array.from({ length: Math.max(0, NEED_FRONT - p.front.length) }, (_, k) => <i key={`e${k}`} className="empty" />)}
            </span>
          </div>
        ))}
      </div>
      {main}
      {errNote}
      {isHost && (
        <div className="host">
          <span className="small muted">เจ้าของห้อง</span>
          <button className="link" onClick={() => send({ type: "skip" })} disabled={busy}>ข้ามตานี้</button>
          <button className="link" onClick={() => send({ type: "deeper" })} disabled={busy}>{v.level < 2 ? "ดำลงชั้นถัดไปเลย" : "จบรอบเลย"}</button>
          <button className="link" onClick={() => send({ type: "lock", locked: !v.locked })} disabled={busy}>{v.locked ? "เปิดรับคนเพิ่ม" : "ปิดรับคนเพิ่ม"}</button>
          {v.players.map((p, j) => p.id !== v.hostId && (
            <button key={p.id} className="link" disabled={busy} onClick={() => send({ type: "kick", player: j })}>เชิญ{p.name}ออก</button>
          ))}
        </div>
      )}
    </main>
  );
}
