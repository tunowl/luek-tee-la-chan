"use client";
import { useEffect, useState } from "react";
import { LOCATIONS, type SpyPrivate, type SpyResult, type SpyView } from "@/lib/spy";
import type { Ctx } from "./shared";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function MinutePicker({ ctx, v }: { ctx: Ctx; v: SpyView }) {
  if (!ctx.isHost) return <p className="muted small">เวลาต่อรอบ {v.minutes} นาที</p>;
  return (
    <div className="row" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <span>เวลาต่อรอบ</span>
      <div className="chips">
        {[5, 6, 7, 8, 10, 12].map((m) => (
          <button key={m} className={`chip ${v.minutes === m ? "on" : ""}`} disabled={ctx.busy} onClick={() => ctx.send({ type: "minutes", minutes: m })}>{m} นาที</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- ห้องรอ ---------- */
export function SpyLobby({ ctx, v }: { ctx: Ctx; v: SpyView }) {
  return (
    <div className="panel">
      <h3>ตั้งค่า</h3>
      <MinutePicker ctx={ctx} v={v} />
      <p className="muted small" style={{ marginTop: 10 }}>
        ทุกคนได้สถานที่เดียวกันพร้อมบทบาทของตัวเอง ยกเว้น 1 คนที่เป็นสายลับและไม่รู้ว่าอยู่ที่ไหน มีสถานที่ให้สุ่ม {LOCATIONS.length} แห่ง
      </p>
    </div>
  );
}

/* ---------- การ์ดลับ (แตะเพื่อดู) ---------- */
function SecretCard({ priv }: { priv: SpyPrivate }) {
  const [open, setOpen] = useState(false);
  if (priv.kind === "none") return <p className="note">คุณเข้ามาระหว่างรอบ รอเล่นรอบถัดไป</p>;
  return (
    <button className={`card wolfcard ${open ? "open" : ""} ${priv.kind === "spy" ? "wolf" : "village"}`} onClick={() => setOpen(!open)} aria-expanded={open}>
      {!open ? (
        <><span className="rname">ดูการ์ดของคุณ</span><span className="meta">แตะเพื่อเปิด อย่าให้คนข้าง ๆ เห็น</span></>
      ) : priv.kind === "spy" ? (
        <>
          <span className="meta">การ์ดของคุณ</span>
          <span className="rname">คุณคือสายลับ</span>
          <span className="q small">ฟังให้ดีว่าทุกคนอยู่ที่ไหน ตอบให้เนียน แล้วทายสถานที่ก่อนถูกจับได้</span>
          <span className="meta" style={{ marginTop: 10 }}>แตะอีกครั้งเพื่อซ่อน</span>
        </>
      ) : (
        <>
          <span className="meta">สถานที่</span>
          <span className="rname">{LOCATIONS[priv.location]?.name}</span>
          <span className="q small">บทบาทของคุณ: <b>{priv.role}</b></span>
          <span className="meta" style={{ marginTop: 10 }}>แตะอีกครั้งเพื่อซ่อน</span>
        </>
      )}
    </button>
  );
}

function resultText(r: SpyResult, nameOf: (id: string) => string): string {
  const spy = nameOf(r.spyId);
  switch (r.reason) {
    case "caught": return `วงจับได้ว่า ${spy} คือสายลับ`;
    case "wrong": return `วงกล่าวหา ${nameOf(r.accused!)} ผิดคน สายลับตัวจริงคือ ${spy}`;
    case "guessed": return `${spy} เป็นสายลับและทายสถานที่ถูก`;
    case "missed": return `${spy} เป็นสายลับแต่ทายผิดว่าเป็น${LOCATIONS[r.guess!]?.name}`;
    case "final-caught": return `หมดเวลา โหวตสุดท้ายจับ ${spy} ได้`;
    case "final-wrong": return r.accused ? `หมดเวลา โหวตสุดท้ายเลือก ${nameOf(r.accused)} ผิดคน สายลับคือ ${spy}` : `หมดเวลา โหวตสุดท้ายเสมอกัน สายลับ ${spy} รอดไป`;
    default: return `เจ้าของห้องเปิดเฉลย สายลับคือ ${spy}`;
  }
}

export default function SpyPlay({ ctx, v, priv }: { ctx: Ctx; v: SpyView; priv: SpyPrivate }) {
  const { myId, isHost, busy, send, online, errNote } = ctx;
  const [now, setNow] = useState(() => Date.now());
  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setTarget(null); setGuess(null); }, [v.phase, v.round]);

  const nameOf = (id: string) => (id === myId ? "คุณ" : v.players.find((p) => p.id === id)?.name ?? "ใครสักคน");
  const ps = v.players.filter((p) => p.playing);
  const me = v.players.find((p) => p.id === myId);
  const playing = !!me?.playing;
  const label = `สายลับในวง · รอบที่ ${v.round}`;
  const left = v.pausedLeft ?? v.endsAt - now;
  const isSpy = priv.kind === "spy";

  const hostBar = isHost && (
    <div className="host">
      <span className="small muted">เจ้าของห้อง</span>
      {v.phase !== "end" && <button className="link" disabled={busy} onClick={() => send({ type: "reveal" })}>เปิดเฉลยเลย</button>}
      <button className="link" disabled={busy} onClick={() => send({ type: "reset" })}>เลิกเกม กลับห้องรอ</button>
      <button className="link" onClick={() => send({ type: "lock", locked: !v.locked })} disabled={busy}>{v.locked ? "เปิดรับคนเพิ่ม" : "ปิดรับคนเพิ่ม"}</button>
      {v.players.map((p, j) => p.id !== v.hostId && (
        <button key={p.id} className="link" disabled={busy} onClick={() => send({ type: "kick", player: j })}>เชิญ{p.name}ออก</button>
      ))}
    </div>
  );
  const scores = (
    <div className="seats">
      {v.players.map((p) => (
        <div className="seat" key={p.id}>
          <span className="nm"><span className={`dot ${online.has(p.id) ? "" : "off"}`} />{p.name}{p.id === myId && <span className="tag">คุณ</span>}</span>
          <span className="tag">{p.score} แต้ม{!p.playing ? " · รอรอบหน้า" : p.accused && v.phase !== "end" ? " · กล่าวหาแล้ว" : ""}</span>
        </div>
      ))}
    </div>
  );

  /* ----- จบรอบ ----- */
  if (v.phase === "end" && v.result) {
    const r = v.result;
    return (
      <main className="wrap">
        {ctx.bar(label)}
        <div className="handoff" style={{ minHeight: "auto", padding: "26px 0 10px" }}>
          <p className="muted">{resultText(r, nameOf)}</p>
          <h1 className="name">{r.reason === "host" ? "เฉลย" : r.winner === "spy" ? "สายลับชนะ" : "วงชนะ"}</h1>
          <p>สถานที่คือ <b>{LOCATIONS[r.location]?.name}</b></p>
        </div>
        {v.roles && (
          <div className="panel">
            <h3>ใครเป็นใคร</h3>
            {Object.entries(v.roles).map(([id, role]) => (
              <div className="who" key={id}><span className="n">{nameOf(id)}</span><span className="st">{role}</span></div>
            ))}
          </div>
        )}
        <p className="muted small" style={{ margin: "14px 0 8px" }}>แต้ม: วงชนะได้คนละ 1 · สายลับรอดได้ 2 · สายลับทายสถานที่ถูกได้ 4</p>
        {scores}
        {isHost ? (
          <div className="stack" style={{ marginTop: 10 }}>
            <MinutePicker ctx={ctx} v={v} />
            <button className="btn" disabled={busy} onClick={() => send({ type: "again" })}>เริ่มรอบใหม่</button>
          </div>
        ) : <p className="muted center">รอเจ้าของห้องเริ่มรอบใหม่</p>}
        {errNote}
        {hostBar}
      </main>
    );
  }

  /* ----- กำลังเล่น ----- */
  const acc = v.accusation;
  let action: React.ReactNode = null;
  if (v.phase === "accuse" && acc) {
    const voters = ps.filter((p) => p.id !== acc.target);
    const mine = playing && acc.target !== myId && acc.votes[myId] === undefined;
    action = (
      <div className="panel">
        <h3>{nameOf(acc.by)} กล่าวหา {nameOf(acc.target)} ว่าเป็นสายลับ</h3>
        <p className="muted small">นาฬิกาหยุดอยู่ ต้องเห็นด้วยทุกคน (ยกเว้นคนถูกกล่าวหา) ถึงจะเปิดการ์ด มีคนไม่เห็นด้วยแค่คนเดียวก็เล่นต่อ</p>
        <p style={{ margin: "10px 0" }}>เห็นด้วยแล้ว {Object.values(acc.votes).filter(Boolean).length}/{voters.length} คน</p>
        {mine ? (
          <div className="myturn">
            <button className="btn" disabled={busy} onClick={() => send({ type: "verdict", yes: true })}>เห็นด้วย เปิดการ์ดเลย</button>
            <button className="btn ghost" disabled={busy} onClick={() => send({ type: "verdict", yes: false })}>ไม่เห็นด้วย</button>
          </div>
        ) : <p className="muted small">{acc.target === myId ? "คุณถูกกล่าวหา แก้ตัวได้เลย" : "รอคนอื่นโหวต"}</p>}
      </div>
    );
  } else if (v.phase === "final") {
    const myVote = v.finalVotes[myId];
    action = (
      <div className="panel">
        <h3>หมดเวลา! โหวตว่าใครคือสายลับ</h3>
        <p className="muted small" style={{ marginBottom: 8 }}>ทุกคนโหวตคนละ 1 เสียง ถ้าคะแนนสูงสุดคือสายลับ วงชนะ ถ้าผิดคนหรือเสมอ สายลับชนะ ({Object.keys(v.finalVotes).length}/{ps.length} โหวตแล้ว)</p>
        {playing && (
          <div className="chips">
            {ps.filter((p) => p.id !== myId).map((p) => (
              <button key={p.id} className={`chip ${myVote === p.id ? "on" : ""}`} disabled={busy} onClick={() => send({ type: "vote", target: myVote === p.id ? null : p.id })}>{p.name}</button>
            ))}
          </div>
        )}
      </div>
    );
  } else if (playing && v.phase === "play") {
    action = (
      <div className="panel">
        <h3>สงสัยใคร</h3>
        {me?.accused ? <p className="muted small">คุณใช้สิทธิ์กล่าวหาไปแล้วในรอบนี้</p> : (
          <>
            <div className="chips">
              {ps.filter((p) => p.id !== myId).map((p) => (
                <button key={p.id} className={`chip ${target === p.id ? "on" : ""}`} onClick={() => setTarget(target === p.id ? null : p.id)}>{p.name}</button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn ghost" disabled={busy || !target} onClick={() => target && send({ type: "accuse", target })}>
                {target ? `กล่าวหา ${nameOf(target)} ว่าเป็นสายลับ` : "เลือกคนที่จะกล่าวหา"}
              </button>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>แต่ละคนกล่าวหาได้ 1 ครั้งต่อรอบ</p>
          </>
        )}
      </div>
    );
  }

  return (
    <main className="wrap">
      {ctx.bar(label)}
      <div className="ropes" style={{ justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--display)", fontSize: 30 }}>{v.phase === "final" ? "0:00" : fmt(left)}</span>
        <p>{v.pausedLeft !== null ? "นาฬิกาหยุดระหว่างกล่าวหา" : left <= 0 && v.phase === "play" ? "หมดเวลาแล้ว" : `${nameOf(v.first)} เริ่มถามก่อน แล้วคนที่ถูกถามถามต่อ`}</p>
      </div>
      {left <= 0 && v.phase === "play" && playing && (
        <button className="btn" style={{ marginBottom: 14 }} disabled={busy} onClick={() => send({ type: "timeup" })}>หมดเวลา ไปโหวตสุดท้าย</button>
      )}
      <SecretCard priv={priv} />
      {action}
      {/* หน้าตาเหมือนกันทุกคนตอนปิดอยู่ คนข้าง ๆ แอบดูก็ไม่รู้ว่าใครเป็นสายลับ */}
      <details>
        <summary>สถานที่ทั้งหมด {LOCATIONS.length} แห่ง</summary>
        {isSpy ? (
          <>
            <p className="muted small" style={{ margin: "8px 0" }}>คุณคือสายลับ ทายได้ครั้งเดียว ถูกชนะทันที ผิดแพ้ทันที</p>
            <div className="chips">
              {LOCATIONS.map((l, k) => (
                <button key={l.name} className={`chip ${guess === k ? "on" : ""}`} onClick={() => setGuess(guess === k ? null : k)}>{l.name}</button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy || guess === null} onClick={() => guess !== null && send({ type: "guess", location: guess })}>
                {guess !== null ? `ทายว่าเป็น${LOCATIONS[guess].name}` : "เลือกสถานที่ก่อน"}
              </button>
            </div>
          </>
        ) : (
          <p className="small" style={{ marginTop: 8 }}>{LOCATIONS.map((l) => l.name).join(" · ")}</p>
        )}
      </details>
      <div style={{ marginTop: 18 }}>{scores}</div>
      {errNote}
      {hostBar}
    </main>
  );
}
