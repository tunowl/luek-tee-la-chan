"use client";
import { useEffect, useState } from "react";
import { LCARDS, type LEvent, type LetterPrivate, type LetterView, type LNote } from "@/lib/letter";
import type { Ctx } from "./shared";

const nm = (v: number) => LCARDS[v]?.name ?? "?";

/* ---------- ห้องรอ: สรุปไพ่ ---------- */
export function LetterLobby({ v }: { v: LetterView }) {
  return (
    <details open>
      <summary>ไพ่ในเกม (21 ใบ)</summary>
      <p className="muted small" style={{ marginTop: 8 }}>
        ถือไพ่ 1 ใบ ถึงตาจั่ว 1 แล้วเล่น 1 ใบ ใครตกรอบก็ออก คนสุดท้ายหรือคนที่ถือแต้มสูงสุดตอนกองหมดชนะรอบ ได้ตรา 1 อัน
        สะสมตราครบ {v.need} อันชนะเกม (จำนวนตราขึ้นกับจำนวนคน)
      </p>
      <ul>
        {LCARDS.map((c) => <li key={c.v} className="small"><b>{c.v} {c.name}</b> ×{c.count}: {c.how}</li>)}
      </ul>
    </details>
  );
}

function eventText(e: LEvent, nameOf: (id: string) => string): string {
  const a = nameOf(e.actor), t = e.target ? nameOf(e.target) : "";
  const head = `${a} เล่น${nm(e.card)}`;
  if (e.res === "protected") return `${head} แต่ไม่มีใครให้เลือก (ทุกคนมีนางกำนัลคุ้มกัน)`;
  switch (e.card) {
    case 1: return e.res === "out" ? `${head} ทาย ${t} ว่าถือ${nm(e.guess!)} ถูก! ${t} ตกรอบ` : `${head} ทาย ${t} ว่าถือ${nm(e.guess!)} ไม่ถูก`;
    case 2: return `${head} แอบดูไพ่ของ ${t}`;
    case 3: return e.res === "tie" ? `${head} เทียบไพ่กับ ${t} เสมอกัน` : `${head} เทียบไพ่กับ ${t} — ${nameOf(e.outId!)} ตกรอบ (ถือ${nm(e.outCard!)})`;
    case 4: return `${head} ได้รับการคุ้มกันจนถึงตาถัดไป`;
    case 5: return e.res === "out" ? `${head} ให้ ${t} ทิ้งเจ้าหญิง ${t} ตกรอบ` : `${head} ให้ ${e.target === e.actor ? "ตัวเอง" : t} ทิ้ง${nm(e.discarded!)} แล้วจั่วใหม่`;
    case 6: return e.res === "draw2" ? `${head} จั่วเพิ่ม เลือกเก็บ 1 ใบ` : `${head} แต่กองหมดแล้ว`;
    case 7: return `${head} แลกไพ่กับ ${t}`;
    case 9: return `${head} ตกรอบ`;
    default: return head;
  }
}
function noteText(n: LNote, nameOf: (id: string) => string): string {
  if (n.kind === "priest") return `${nameOf(n.other)} ถือ${nm(n.theirs)} (${n.theirs})`;
  return `เทียบกับ ${nameOf(n.other)}: เขาถือ${nm(n.theirs)} (${n.theirs}) คุณถือ${nm(n.mine!)} (${n.mine})`;
}

function CardTile({ v, picked, onClick, disabled }: { v: number; picked?: boolean; onClick?: () => void; disabled?: boolean }) {
  const c = LCARDS[v];
  return (
    <button className={`card lcard ${picked ? "picked" : ""}`} data-v={v} onClick={onClick} disabled={disabled || !onClick} aria-pressed={onClick ? !!picked : undefined}>
      <span className="lv">{v}</span>
      <span className="rname">{c.name}</span>
      <span className="q small">{c.how}</span>
    </button>
  );
}

export default function LetterPlay({ ctx, v, priv }: { ctx: Ctx; v: LetterView; priv: LetterPrivate }) {
  const { myId, myI, isHost, busy, send, online, errNote } = ctx;
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const nameOf = (id: string) => (id === myId ? "คุณ" : v.players.find((p) => p.id === id)?.name ?? "ใครสักคน");
  const me = v.players[myI];
  const myTurn = v.phase === "play" && v.current === myI;
  const hand = priv.hand;

  const turnKey = `${v.round}|${v.current}|${v.chancellor}|${v.phase}`;
  useEffect(() => { setCard(null); setTarget(null); setGuess(null); }, [turnKey]);

  const label = `จดหมายลับ · รอบที่ ${v.round}`;
  const seats = (
    <div className="seats">
      {v.players.map((p, i) => (
        <div className={`seat ${v.phase === "play" && i === v.current ? "turn" : ""} ${p.out ? "dead" : ""}`} key={p.id}>
          <span className="nm"><span className={`dot ${online.has(p.id) ? "" : "off"}`} />{p.name}{p.id === myId && <span className="tag">คุณ</span>}</span>
          <span className="tag">ตรา {p.tokens}/{v.need}{p.out ? " · ตกรอบ" : p.prot ? " · คุ้มกัน" : ""}</span>
          <span className="disc">{p.discards.map((d, k) => <i key={k} data-v={d} title={nm(d)}>{d}</i>)}</span>
        </div>
      ))}
    </div>
  );
  const log = v.events.length > 0 && (
    <div className="panel">
      <h3>เกิดอะไรขึ้นบ้าง</h3>
      {[...v.events].reverse().slice(0, 5).map((e) => <p className="small" key={e.n}>{eventText(e, nameOf)}</p>)}
    </div>
  );
  const notes = priv.notes.length > 0 && v.phase === "play" && (
    <div className="panel">
      <h3>สิ่งที่คุณรู้ (เห็นเฉพาะคุณ)</h3>
      {[...priv.notes].reverse().map((n) => <p className="small" key={n.n}>{noteText(n, nameOf)}</p>)}
      <p className="muted small" style={{ marginTop: 6 }}>ไพ่อาจเปลี่ยนมือไปแล้วถ้ามีคนเล่นกษัตริย์หรือเจ้าชาย</p>
    </div>
  );
  const hostBar = isHost && (
    <div className="host">
      <span className="small muted">เจ้าของห้อง</span>
      <button className="link" disabled={busy} onClick={() => send({ type: "reset" })}>เลิกเกม กลับห้องรอ</button>
      <button className="link" onClick={() => send({ type: "lock", locked: !v.locked })} disabled={busy}>{v.locked ? "เปิดรับคนเพิ่ม" : "ปิดรับคนเพิ่ม"}</button>
      {v.players.map((p, j) => p.id !== v.hostId && (
        <button key={p.id} className="link" disabled={busy} onClick={() => send({ type: "kick", player: j })}>เชิญ{p.name}ออก</button>
      ))}
    </div>
  );

  /* ----- จบรอบ / จบเกม ----- */
  if (v.phase === "round" || v.phase === "end") {
    const w = v.roundWin;
    const end = v.phase === "end";
    const champs = v.players.filter((p) => p.tokens >= v.need);
    return (
      <main className="wrap">
        {ctx.bar(label)}
        <div className="handoff" style={{ minHeight: "auto", padding: "26px 0 10px" }}>
          <p className="muted">{w?.reason === "last" ? "เหลือคนสุดท้ายในรอบ" : "กองไพ่หมดแล้ว เปิดไพ่เทียบกัน"}</p>
          <h1 className="name">{end ? `${champs.map((p) => nameOf(p.id)).join(", ")} ชนะเกม!` : `${(w?.ids ?? []).map(nameOf).join(", ")} ชนะรอบนี้`}</h1>
          {w?.spy && <p>{nameOf(w.spy)} เป็นคนเดียวที่เหลือพร้อมสายลับ ได้ตราเพิ่ม 1</p>}
        </div>
        {w && Object.keys(w.hands).length > 0 && (
          <div className="panel">
            <h3>ไพ่ในมือตอนจบรอบ</h3>
            {Object.entries(w.hands).map(([id, c]) => (
              <div className="who" key={id}><span className="n">{nameOf(id)}</span><span className="st">{c} {nm(c)}</span></div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16 }}>{seats}</div>
        {log}
        <div style={{ marginTop: 20 }}>
          {end
            ? isHost ? <button className="btn" disabled={busy} onClick={() => send({ type: "again" })}>เล่นอีกเกม</button> : <p className="muted center">รอเจ้าของห้องเริ่มเกมใหม่</p>
            : <button className="btn" disabled={busy} onClick={() => send({ type: "next" })}>เริ่มรอบถัดไป</button>}
        </div>
        {errNote}
        {hostBar}
      </main>
    );
  }

  /* ----- กำลังเล่น ----- */
  const cur = v.players[v.current];
  let main: React.ReactNode;
  if (myTurn && v.chancellor) {
    main = (
      <>
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>ราชเลขา: เลือกเก็บ 1 ใบ</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>ใบที่เหลือจะถูกสอดไว้ใต้กอง</p>
        <div className="hand">{hand.map((c, k) => <CardTile key={k} v={c} picked={card === c} onClick={() => setCard(c)} />)}</div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy || card === null} onClick={() => card !== null && send({ type: "keep", card })}>เก็บใบนี้</button>
        </div>
      </>
    );
  } else if (myTurn) {
    const forced = hand.includes(8) && (hand.includes(5) || hand.includes(7));
    const info = card !== null ? LCARDS[card] : null;
    const others = v.players.filter((p, j) => j !== myI && !p.out && !p.prot);
    const cands = !info ? [] : info.target === "any" ? [...others, me] : info.target === "other" ? others : [];
    const needT = cands.length > 0;
    const needG = card === 1 && needT;
    const ok = card !== null && (!needT || !!target) && (!needG || guess !== null) && !(forced && card !== 8);
    main = (
      <>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>ตาคุณ เลือกเล่น 1 ใบ</h2>
        <div className="hand">
          {hand.map((c, k) => <CardTile key={k} v={c} picked={card === c} disabled={forced && c !== 8} onClick={() => { setCard(c); setTarget(null); setGuess(null); }} />)}
        </div>
        {forced && <p className="note">มีกษัตริย์หรือเจ้าชายคู่กับเคาน์เตส ต้องเล่นเคาน์เตส</p>}
        {info && (
          <div className="panel">
            {info.target !== "none" && !needT && <p>ทุกคนมีนางกำนัลคุ้มกัน ไพ่ใบนี้จะไม่มีผล</p>}
            {needT && (
              <>
                <h3>{card === 5 ? "ให้ใครทิ้งไพ่" : "เลือกเป้าหมาย"}</h3>
                <div className="chips">
                  {cands.map((p) => (
                    <button key={p.id} className={`chip ${target === p.id ? "on" : ""}`} onClick={() => setTarget(p.id)}>{p.id === myId ? "ตัวเอง" : p.name}</button>
                  ))}
                </div>
              </>
            )}
            {needG && (
              <>
                <h3 style={{ marginTop: 14 }}>ทายว่าเขาถือ</h3>
                <div className="chips">
                  {LCARDS.filter((c) => c.v !== 1).map((c) => (
                    <button key={c.v} className={`chip ${guess === c.v ? "on" : ""}`} onClick={() => setGuess(c.v)}>{c.v} {c.name}</button>
                  ))}
                </div>
              </>
            )}
            {card === 9 && <p className="note">ถ้าเล่นเจ้าหญิง คุณจะตกรอบทันที</p>}
            <div style={{ marginTop: 16 }}>
              <button className="btn" disabled={!ok || busy} onClick={() => card !== null && send({ type: "play", card, target: needT ? target : null, guess: needG ? guess : null })}>
                {busy ? "กำลังส่ง…" : `เล่น${info.name}`}
              </button>
            </div>
          </div>
        )}
      </>
    );
  } else {
    main = (
      <>
        <p style={{ fontFamily: "var(--display)", fontSize: 22, marginBottom: 10 }}>
          {me?.out ? "คุณตกรอบนี้แล้ว รอรอบถัดไป" : `รอ${cur?.name}${v.chancellor ? "เลือกไพ่ที่จะเก็บ" : "เล่นไพ่"}`}
        </p>
        {hand.length > 0 && <><p className="muted small" style={{ marginBottom: 8 }}>ไพ่ในมือคุณ</p><div className="hand">{hand.map((c, k) => <CardTile key={k} v={c} />)}</div></>}
      </>
    );
  }

  return (
    <main className="wrap">
      {ctx.bar(label)}
      {seats}
      <p className="muted small" style={{ marginBottom: 14 }}>
        กองเหลือ {v.deckCount} ใบ{v.faceUp.length > 0 && ` · ไพ่ที่เปิดออกไปตอนเริ่มรอบ: ${v.faceUp.map((c) => `${c} ${nm(c)}`).join(", ")}`}
      </p>
      {main}
      {notes}
      {log}
      {errNote}
      {hostBar}
    </main>
  );
}
