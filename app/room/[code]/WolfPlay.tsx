"use client";
import { useState } from "react";
import { ROLES, ROLE_ORDER, rosterFor, rosterProblem, type WolfEvent, type WolfPrivate, type WolfRole, type WolfSettings, type WolfView } from "@/lib/wolf";
import type { Ctx } from "./shared";

const rosterText = (r: Record<WolfRole, number>) =>
  ROLE_ORDER.filter((k) => r[k] > 0).map((k) => `${ROLES[k].name} ${r[k]}`).join(" · ");

/* ---------- ห้องรอ: ตั้งค่าบทบาท ---------- */
export function WolfLobby({ ctx, v }: { ctx: Ctx; v: WolfView }) {
  const { isHost, busy, send } = ctx;
  const n = v.players.length - 1;
  const s = v.settings;
  const r = rosterFor(n, s);
  const bad = rosterProblem(n, r);
  const set = (patch: Partial<WolfSettings>) => send({ type: "settings", ...s, ...patch });
  return (
    <div className="panel">
      <h3>บทบาทที่จะแจก ({n} คน ไม่รวมผู้ดำเนินเกม)</h3>
      <p>{n > 0 ? rosterText(r) : "ยังไม่มีผู้เล่น"}</p>
      {bad && <p className="muted small" style={{ marginTop: 6 }}>{bad}</p>}
      <p className="muted small" style={{ marginTop: 8 }}>
        เจ้าของห้องเป็นผู้ดำเนินเกม ไม่ได้รับบทบาท จะเห็นบทบาทของทุกคนและเป็นคนพากย์ตอนกลางคืน
      </p>
      {isHost && (
        <>
          <label className="toggle"><input type="checkbox" checked={s.auto} disabled={busy} onChange={() => set({ auto: !s.auto })} />
            <span>จัดบทบาทอัตโนมัติตามจำนวนคน</span></label>
          {!s.auto && (
            <>
              <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
                <span>หมาป่า</span>
                <div className="chips">
                  {[1, 2, 3, 4, 5].map((k) => (
                    <button key={k} className={`chip ${s.wolves === k ? "on" : ""}`} disabled={busy} onClick={() => set({ wolves: k })}>{k}</button>
                  ))}
                </div>
              </div>
              {(["seer", "doctor", "hunter"] as const).map((k) => (
                <label className="toggle" key={k}><input type="checkbox" checked={s[k]} disabled={busy} onChange={() => set({ [k]: !s[k] } as Partial<WolfSettings>)} />
                  <span><b>{ROLES[k].name}</b>: {ROLES[k].how}</span></label>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- การ์ดบทบาท (แตะเพื่อดู ป้องกันคนข้าง ๆ แอบเห็น) ---------- */
function RoleCard({ role, pack, nameOf }: { role: WolfRole; pack: string[]; nameOf: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  const R = ROLES[role];
  return (
    <button className={`card wolfcard ${open ? "open" : ""} ${R.team}`} onClick={() => setOpen(!open)} aria-expanded={open}>
      {open ? (
        <>
          <span className="meta">บทบาทของคุณ · ฝ่าย{R.team === "wolf" ? "หมาป่า" : "ชาวบ้าน"}</span>
          <span className="rname">{R.name}</span>
          <span className="q small">{R.how}</span>
          {role === "wolf" && (
            <span className="q small" style={{ marginTop: 8 }}>
              {pack.length ? `หมาป่าตัวอื่น: ${pack.map(nameOf).join(", ")}` : "คุณเป็นหมาป่าตัวเดียว"}
            </span>
          )}
          <span className="meta" style={{ marginTop: 10 }}>แตะอีกครั้งเพื่อซ่อน</span>
        </>
      ) : (
        <>
          <span className="rname">ดูบทบาทของคุณ</span>
          <span className="meta">แตะเพื่อเปิด อย่าให้คนข้าง ๆ เห็น</span>
        </>
      )}
    </button>
  );
}

function eventText(e: WolfEvent, nameOf: (id: string) => string): string {
  if (e.type === "night") return e.died.length ? `คืนที่ ${e.day}: ${e.died.map(nameOf).join(", ")} ถูกพบเป็นศพ` : `คืนที่ ${e.day}: ไม่มีใครตาย`;
  if (e.type === "vote") return e.died ? `วันที่ ${e.day}: หมู่บ้านโหวตประหาร ${nameOf(e.died)}` : `วันที่ ${e.day}: หมู่บ้านไม่ประหารใคร`;
  return e.alive ? `${nameOf(e.id)} กลับมามีชีวิต (ผู้ดำเนินเกมแก้ไข)` : `${nameOf(e.id)} ตาย`;
}

/* ---------- หน้าเล่น ---------- */
export default function WolfPlay({ ctx, v, priv }: { ctx: Ctx; v: WolfView; priv: WolfPrivate }) {
  const { myId, isHost, busy, send, online, errNote } = ctx;
  const [exec, setExec] = useState<string | null>(null);
  const nameOf = (id: string) => v.players.find((p) => p.id === id)?.name ?? "ใครสักคน";
  const playing = v.players.filter((p) => p.playing);
  const alive = playing.filter((p) => p.alive);
  const me = v.players.find((p) => p.id === myId);

  const label = v.phase === "night" ? `มนุษย์หมาป่า · คืนที่ ${v.day}` : v.phase === "day" ? `มนุษย์หมาป่า · วันที่ ${v.day}` : "มนุษย์หมาป่า · จบเกม";
  const lastEvents = [...v.events].reverse().slice(0, 6);
  const tally: Record<string, string[]> = {};
  Object.entries(v.votes).forEach(([from, to]) => { (tally[to] ||= []).push(from); });
  const top = Object.entries(tally).sort((a, b) => b[1].length - a[1].length);

  const voteList = (
    <div className="panel">
      <h3>ผลโหวตตอนนี้ ({Object.keys(v.votes).length}/{alive.length} คน)</h3>
      {top.length === 0 ? <p className="muted small">ยังไม่มีใครโหวต</p> : top.map(([to, from]) => (
        <div className="who" key={to}>
          <span className="n">{nameOf(to)} · {from.length}</span>
          <span className="st">{from.map(nameOf).join(", ")}</span>
        </div>
      ))}
    </div>
  );

  /* ----- จบเกม ----- */
  if (v.phase === "end") {
    return (
      <main className="wrap">
        {ctx.bar(label)}
        <div className="handoff" style={{ minHeight: "auto", padding: "30px 0" }}>
          <p className="muted">จบเกมแล้ว</p>
          <h1 className="name">{v.winner === "wolf" ? "หมาป่าชนะ" : "ชาวบ้านชนะ"}</h1>
          <p>{v.winner === "wolf" ? "หมาป่ามีจำนวนเท่ากับชาวบ้านที่เหลือแล้ว" : "หมาป่าถูกกำจัดหมดแล้ว"}</p>
        </div>
        <div className="plist">
          {playing.map((p) => (
            <div className="pl" key={p.id}>
              <span className={`dot ${p.alive ? "" : "off"}`} />{p.name}
              <span className="tag">{p.role ? ROLES[p.role].name : ""}{p.alive ? "" : " · ตาย"}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          {isHost ? <button className="btn" disabled={busy} onClick={() => send({ type: "reset" })}>กลับห้องรอ เล่นอีกเกม</button>
            : <p className="muted center">รอผู้ดำเนินเกมเริ่มเกมใหม่</p>}
        </div>
        {errNote}
      </main>
    );
  }

  /* ----- ผู้ดำเนินเกม ----- */
  if (isHost && priv.kind === "mod") {
    const roleOf = (id: string) => priv.roles[id];
    const has = (r: WolfRole) => alive.some((p) => roleOf(p.id) === r);
    const pick = (step: "kill" | "save" | "check", list = alive) => (
      <div className="chips">
        {list.map((p) => (
          <button key={p.id} className={`chip ${priv.night[step] === p.id ? "on" : ""}`} disabled={busy}
            onClick={() => send({ type: "night", step, target: priv.night[step] === p.id ? null : p.id })}>{p.name}</button>
        ))}
      </div>
    );
    const wolves = alive.filter((p) => roleOf(p.id) === "wolf");
    const willDie = priv.night.kill && priv.night.kill !== priv.night.save ? priv.night.kill : null;
    let main: React.ReactNode;
    if (v.phase === "night") {
      main = (
        <>
          <h2 style={{ fontSize: 24 }}>คืนที่ {v.day}</h2>
          <p className="muted" style={{ marginTop: 4 }}>พูดว่า &ldquo;ทุกคนหลับตา&rdquo; แล้วปลุกทีละบทบาทตามลำดับ</p>
          <div className="panel">
            <h3>1. หมาป่าลืมตา ({wolves.map((p) => p.name).join(", ")})</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>หมาป่าชี้เหยื่อ แตะชื่อคนที่ถูกเลือก</p>
            {pick("kill", alive)}
          </div>
          {v.roster.seer > 0 && (
            <div className="panel">
              <h3>2. ผู้หยั่งรู้ลืมตา{has("seer") ? "" : " (ตายแล้ว แกล้งปลุกต่อ)"}</h3>
              {has("seer") && <>
                <p className="muted small" style={{ marginBottom: 8 }}>แตะคนที่ผู้หยั่งรู้ชี้ แล้วส่งสัญญาณผลให้ดู</p>
                {pick("check")}
                {priv.checkIsWolf !== null && (
                  <p className="note" style={{ marginTop: 10 }}><b>{nameOf(priv.night.check!)}</b> {priv.checkIsWolf ? "เป็นหมาป่า (ชูนิ้วโป้งลง)" : "ไม่ใช่หมาป่า (ชูนิ้วโป้งขึ้น)"}</p>
                )}
              </>}
            </div>
          )}
          {v.roster.doctor > 0 && (
            <div className="panel">
              <h3>3. หมอลืมตา{has("doctor") ? "" : " (ตายแล้ว แกล้งปลุกต่อ)"}</h3>
              {has("doctor") && <><p className="muted small" style={{ marginBottom: 8 }}>แตะคนที่หมอเลือกปกป้อง</p>{pick("save")}</>}
            </div>
          )}
          <div className="panel">
            <h3>4. ทุกคนลืมตา</h3>
            <p style={{ marginBottom: 12 }}>{willDie ? `จะประกาศว่า ${nameOf(willDie)} ตาย` : priv.night.kill ? "หมอช่วยไว้ได้ คืนนี้ไม่มีใครตาย" : "ยังไม่ได้เลือกเหยื่อ คืนนี้จะไม่มีใครตาย"}</p>
            <button className="btn" disabled={busy} onClick={() => send({ type: "dawn" })}>ฟ้าสาง ประกาศผล</button>
          </div>
        </>
      );
    } else {
      const choice = exec ?? top[0]?.[0] ?? null;
      main = (
        <>
          <h2 style={{ fontSize: 24 }}>วันที่ {v.day}</h2>
          <p className="muted" style={{ marginTop: 4 }}>ให้วงคุยกัน แล้วโหวตจากโทรศัพท์ของแต่ละคน</p>
          {voteList}
          <div className="panel">
            <h3>ประหาร</h3>
            <div className="chips">
              {alive.map((p) => (
                <button key={p.id} className={`chip ${choice === p.id ? "on" : ""}`} disabled={busy} onClick={() => setExec(p.id)}>{p.name}</button>
              ))}
            </div>
            <div className="myturn">
              <button className="btn" disabled={busy || !choice} onClick={() => { setExec(null); send({ type: "execute", target: choice }); }}>
                {choice ? `ประหาร ${nameOf(choice)} แล้วเข้าสู่กลางคืน` : "เลือกคนที่จะประหาร"}
              </button>
              <button className="btn ghost" disabled={busy} onClick={() => { setExec(null); send({ type: "execute", target: null }); }}>ไม่ประหารใคร เข้าสู่กลางคืน</button>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>ถ้าคนที่ตายเป็นนายพราน ให้เขาชี้ยิงแล้วกด &ldquo;ตาย&rdquo; ที่ชื่อคนนั้นด้านล่าง</p>
          </div>
        </>
      );
    }
    return (
      <main className="wrap">
        {ctx.bar(label)}
        {main}
        <div className="panel">
          <h3>บทบาททุกคน (เห็นเฉพาะคุณ)</h3>
          {playing.map((p) => (
            <div className="who" key={p.id}>
              <span className="n"><span className={`dot ${online.has(p.id) ? "" : "off"}`} /> {p.name} <span className="tag">· {ROLES[roleOf(p.id)]?.name}</span></span>
              <button className="link" disabled={busy} onClick={() => send({ type: "mark", target: p.id, alive: !p.alive })}>{p.alive ? "ตาย" : "ตายแล้ว · ฟื้น"}</button>
            </div>
          ))}
        </div>
        {lastEvents.length > 0 && <div className="panel"><h3>เหตุการณ์</h3>{lastEvents.map((e) => <p key={e.n} className="small">{eventText(e, nameOf)}</p>)}</div>}
        {errNote}
        <div className="host">
          <span className="small muted">ผู้ดำเนินเกม</span>
          <button className="link" disabled={busy} onClick={() => send({ type: "reset" })}>ยกเลิกเกม กลับห้องรอ</button>
          <button className="link" onClick={() => send({ type: "lock", locked: !v.locked })} disabled={busy}>{v.locked ? "เปิดรับคนเพิ่ม" : "ปิดรับคนเพิ่ม"}</button>
          {v.players.map((p, j) => p.id !== v.hostId && (
            <button key={p.id} className="link" disabled={busy} onClick={() => send({ type: "kick", player: j })}>เชิญ{p.name}ออก</button>
          ))}
        </div>
      </main>
    );
  }

  /* ----- ผู้เล่น / คนดูข้างสนาม ----- */
  const amAlive = priv.kind === "player" && !!me?.alive;
  const myVote = myId ? v.votes[myId] : undefined;
  const latest = lastEvents[0];
  return (
    <main className="wrap">
      {ctx.bar(label)}
      {priv.kind === "player" ? <RoleCard role={priv.role} pack={priv.pack} nameOf={nameOf} /> : (
        <p className="note">คุณเข้ามาระหว่างเกม ดูอยู่ข้างสนามก่อน จะได้บทบาทในเกมถัดไป</p>
      )}
      {priv.kind === "player" && !me?.alive && <p className="note">คุณตายแล้ว ดูต่อได้ แต่ห้ามบอกใบ้ใคร</p>}

      {v.phase === "night" ? (
        <div className="handoff" style={{ minHeight: "38vh" }}>
          <h1 className="name">หลับตา</h1>
          <p>กลางคืนแล้ว ทำตามที่ผู้ดำเนินเกมบอก ถ้าถูกปลุก ให้ชี้แทนการพูด</p>
        </div>
      ) : (
        <>
          {latest && <p style={{ fontFamily: "var(--display)", fontSize: 21, margin: "18px 0 4px" }}>{eventText(latest, nameOf)}</p>}
          {amAlive && (
            <div className="panel">
              <h3>โหวตประหารใคร</h3>
              <div className="chips">
                {alive.filter((p) => p.id !== myId).map((p) => (
                  <button key={p.id} className={`chip ${myVote === p.id ? "on" : ""}`} disabled={busy}
                    onClick={() => send({ type: "vote", target: myVote === p.id ? null : p.id })}>{p.name}</button>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 8 }}>เปลี่ยนใจได้จนกว่าผู้ดำเนินเกมจะสรุปผล ทุกคนเห็นว่าใครโหวตใคร</p>
            </div>
          )}
          {voteList}
        </>
      )}

      <div className="seats" style={{ marginTop: 18 }}>
        {playing.map((p) => (
          <div className={`seat ${p.alive ? "" : "dead"}`} key={p.id}>
            <span className="nm"><span className={`dot ${online.has(p.id) ? "" : "off"}`} />{p.name}{p.id === myId && <span className="tag">คุณ</span>}</span>
            {!p.alive && <span className="tag">ตายแล้ว</span>}
          </div>
        ))}
      </div>
      <p className="muted small">ในเกมนี้มี: {rosterText(v.roster)} · ผู้ดำเนินเกม: {nameOf(v.hostId)}</p>
      {lastEvents.length > 1 && <details><summary>เหตุการณ์ที่ผ่านมา</summary><ul>{lastEvents.map((e) => <li key={e.n} className="small">{eventText(e, nameOf)}</li>)}</ul></details>}
      {errNote}
    </main>
  );
}
