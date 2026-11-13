"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadQuestionTexts } from "@/lib/questions-client";
import { LEVELS, ROPES } from "@/lib/ui";
import { NEED_FRONT, SPECIALS, tableRopes, type Card, type GameEvent, type GameView, type QCard, type Special } from "@/lib/engine";
import { cssVar, type Ctx } from "./shared";

// สวิตช์โหมดทะลึ่ง 18+ (ห้องรอ และหน้าจบรอบ)
export function SpicyToggle({ ctx, on }: { ctx: Ctx; on: boolean }) {
  if (!ctx.isHost) return on ? <p className="note">ห้องนี้เปิดโหมดทะลึ่ง 18+ มีคำถามเรื่องรัก ๆ ใคร่ ๆ ปนอยู่ทุกชั้น ไม่สบายใจข้อไหนใช้การ์ดผ่านได้</p> : null;
  return (
    <label className="toggle"><input type="checkbox" checked={on} disabled={ctx.busy} onChange={() => ctx.send({ type: "spicy", on: !on })} />
      <span>เปิด<b>โหมดทะลึ่ง 18+</b> เพิ่มคำถามเรื่องรัก ๆ ใคร่ ๆ 50 ข้อ ขำ ๆ ที่ผิวน้ำ แล้วจริงจังขึ้นเมื่อดำลึก (เล่นกับผู้ใหญ่ที่สนิทกันเท่านั้น)</span></label>
  );
}

type Sel = { hi: number | null; targets: number[]; dbl: boolean; all: boolean };
const emptySel: Sel = { hi: null, targets: [], dbl: false, all: false };

// หน้าเล่นของ "ลึกทีละชั้น" (การ์ดชวนคุย)
export default function LthPlay({ ctx, v, hand }: { ctx: Ctx; v: GameView; hand: Card[] }) {
  const { myId, myI, isHost, busy, online, send, errNote } = ctx;
  const [texts, setTexts] = useState<Map<number, string>>(new Map());
  const [textErr, setTextErr] = useState("");
  const [sel, setSel] = useState<Sel>(emptySel);
  const [budPick, setBudPick] = useState(false);
  const [toast, setToast] = useState<GameEvent | null>(null);
  const seenSeq = useRef<number | null>(null);
  const meP = myI > -1 ? v.players[myI] : null;

  useEffect(() => {
    loadQuestionTexts().then(setTexts).catch(() => setTextErr("โหลดคำถามไม่สำเร็จ ลองรีเฟรชหน้า"));
  }, []);

  const turnKey = `${v.phase}|${v.level}|${v.current}|${v.pending ? 1 : 0}`;
  useEffect(() => { setSel(emptySel); setBudPick(false); }, [turnKey]);

  useEffect(() => {
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
  }, [v.eventSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const qText = (c: QCard) => texts.get(c.id) ?? "…";
  const ropes = useMemo(() => tableRopes(v), [v]);
  const nameOf = (id: string) => v.players.find((p) => p.id === id)?.name ?? "ใครสักคน";
  const notes = <>{textErr && <p className="note" role="alert">{textErr}</p>}{errNote}</>;

  const L = LEVELS[v.level];
  const bar = ctx.bar(<><span className="swatch" style={{ background: L.strip.replace("180deg", "90deg") }} />ชั้น{L.name}</>);

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
            ? isHost ? <><SpicyToggle ctx={ctx} on={v.spicy} /><button className="btn" style={{ marginTop: 14 }} onClick={() => send({ type: "again" })} disabled={busy}>เล่นอีกรอบ</button></> : <p className="muted center">รอเจ้าของห้องเริ่มรอบใหม่</p>
            : <button className="btn" onClick={() => send({ type: "next" })} disabled={busy}>ดำลงไป</button>}
          {notes}
        </div>
      </main>
    );
  }

  /* ---------- play ---------- */
  const q = v.pending;
  const cur = v.players[v.current];
  const ropeTag = (c: QCard) => (
    <span className="rope" style={cssVar("--rc", ROPES[c.rope].c)}><i />&nbsp;เชือก{ROPES[c.rope].n}{!ropes.has(c.rope) && " · สีใหม่"}{c.sp && " · 18+"}</span>
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

  // การ์ดคำถามอยู่ด้านบน การ์ดพิเศษรวมเป็นกล่องเล็กกล่องเดียวด้านล่าง
  const specialCount = (Object.keys(SPECIALS) as Special[])
    .map((k) => ({ k, n: hand.filter((c) => c.kind === "s" && c.s === k).length }))
    .filter((x) => x.n > 0);
  const handView = (clickable: boolean) => (
    <>
      <div className="hand">{hand.map((c, i) => (c.kind === "q" ? cardView(c, i, clickable) : null))}</div>
      {specialCount.length > 0 && (
        <details className="specials">
          <summary>การ์ดพิเศษ {specialCount.map((x) => `${SPECIALS[x.k].name}${x.n > 1 ? ` ×${x.n}` : ""}`).join(" · ")}</summary>
          <ul>{specialCount.map((x) => <li key={x.k}><b>{SPECIALS[x.k].name}</b>: {SPECIALS[x.k].how}</li>)}</ul>
        </details>
      )}
    </>
  );

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
        {handView(true)}
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
        {handView(false)}
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
      {notes}
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
