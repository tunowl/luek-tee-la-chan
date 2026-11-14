"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CODE_LEN, CODE_RE, LEVELS, lastName, saveName } from "@/lib/ui";
import { DECKS, DECK_KEYS, NEED_FRONT, SPECIALS } from "@/lib/engine";
import { GAMES, GAME_KINDS, type GameKind } from "@/lib/games";
import { ROLES, ROLE_ORDER } from "@/lib/wolf";
import { LCARDS } from "@/lib/letter";
import { LOCATIONS } from "@/lib/spy";

function Rules({ game }: { game: GameKind }) {
  if (game === "wolf") {
    return (
      <>
        <ol>
          <li>เจ้าของห้องเป็น<b>ผู้ดำเนินเกม</b> ไม่ได้รับบทบาท ผู้เล่นอย่างน้อย 5 คน (เล่นสนุกสุดที่ 7–12 คน)</li>
          <li>ทุกคนเปิดดูบทบาทลับในโทรศัพท์ของตัวเอง หมาป่าจะเห็นว่าใครเป็นพวกเดียวกัน</li>
          <li><b>กลางคืน</b> ทุกคนหลับตา ผู้ดำเนินเกมปลุกหมาป่า ผู้หยั่งรู้ และหมอทีละบทบาท แล้วแตะบันทึกสิ่งที่แต่ละคนชี้</li>
          <li><b>กลางวัน</b> ประกาศว่าใครตาย วงถกเถียงกัน แล้วโหวตจากโทรศัพท์ ผู้ดำเนินเกมสรุปว่าจะประหารใคร</li>
          <li>ชาวบ้านชนะเมื่อหมาป่าหมด หมาป่าชนะเมื่อจำนวนเท่ากับชาวบ้านที่เหลือ</li>
        </ol>
        <ul className="muted">{ROLE_ORDER.map((r) => <li key={r}><b>{ROLES[r].name}</b>: {ROLES[r].how}</li>)}</ul>
      </>
    );
  }
  if (game === "spy") {
    return (
      <ol>
        <li>ทุกคนได้การ์ดบอก<b>สถานที่</b>เดียวกันพร้อมบทบาทของตัวเอง ยกเว้น 1 คนที่เป็น<b>สายลับ</b> ซึ่งไม่รู้ว่าอยู่ที่ไหน</li>
        <li>ผลัดกันถามคำถามใครก็ได้เกี่ยวกับสถานที่ ตอบให้พอรู้ว่าเป็นพวกเดียวกัน แต่อย่าชัดจนสายลับเดาได้</li>
        <li>ระหว่างเล่น ใครสงสัยใครกดกล่าวหาได้คนละครั้ง ถ้าทุกคนเห็นด้วยจะเปิดการ์ดทันที</li>
        <li>สายลับเปิดตัวแล้วทายสถานที่ได้ทุกเมื่อ ถูกชนะ ผิดแพ้</li>
        <li>หมดเวลาแล้วโหวตสุดท้าย ถ้าเสียงส่วนใหญ่ชี้ถูกตัว วงชนะ</li>
        <li className="muted">มีสถานที่ {LOCATIONS.length} แห่ง: {LOCATIONS.map((l) => l.name).join(" · ")}</li>
      </ol>
    );
  }
  if (game === "letter") {
    return (
      <>
        <ol>
          <li>ทุกคนถือไพ่ 1 ใบ ถึงตาให้จั่ว 1 ใบ แล้วเลือกเล่น 1 ใน 2 ใบ ทำตามความสามารถของไพ่</li>
          <li>ใครตกรอบก็ออกจากรอบนั้น ไพ่ที่เล่นแล้วทุกคนเห็น</li>
          <li>รอบจบเมื่อเหลือคนเดียว หรือกองหมด (คนที่ถือแต้มสูงสุดชนะ) ผู้ชนะได้ตรา 1 อัน</li>
          <li>สะสมตราครบก่อนชนะเกม: 2 คน 6 อัน · 3 คน 5 อัน · 4 คน 4 อัน · 5–6 คน 3 อัน</li>
        </ol>
        <ul className="muted">{LCARDS.map((c) => <li key={c.v}><b>{c.v} {c.name}</b> ×{c.count}: {c.how}</li>)}</ul>
      </>
    );
  }
  return (
    <>
      <ol>
        <li>ทุกคนได้การ์ดคำถาม 5 ใบ และการ์ด<b>ผ่าน</b> 1 ใบ</li>
        <li>ถึงตาใคร ให้เลือกการ์ดคำถามหนึ่งใบ แล้วเลือกคนที่จะถาม (ห้ามถามคนที่เพิ่งถูกถามไปตาที่แล้ว ยกเว้นใช้การ์ดพิเศษ)</li>
        <li>คนถูกถามตอบ หรือใช้การ์ดผ่านได้โดยไม่ต้องอธิบาย การ์ดที่ตอบแล้วจะไปวางตรงหน้าคนตอบ</li>
        <li>การ์ดคำถามทุกใบมีเชือกหนึ่งในหกสี ใครได้การ์ดที่มีเชือก<b>สีที่วงยังไม่มี</b>ในชั้นนี้ จะได้การ์ดพิเศษเพิ่ม 1 ใบ</li>
        <li>วงดำลงชั้นถัดไปเมื่อ<b>การ์ดตรงหน้าทุกคนรวมกันมีเชือกครบ 6 สี</b> หรือ<b>ทุกคนมีการ์ดตรงหน้าครบ {NEED_FRONT} ใบ</b></li>
        <li>จบชั้นก้นทะเลเมื่อไหร่ ก็จบรอบ</li>
        <li>ก่อนเริ่ม เจ้าของห้องเลือก<b>สำรับ</b>ได้ ผสมกันได้หลายสำรับ เช่น ธรรมดา + คู่รัก</li>
      </ol>
      <ul className="muted">
        {DECK_KEYS.map((k) => <li key={k}><b>สำรับ{DECKS[k].name}</b> (147 ข้อ): {DECKS[k].desc}</li>)}
      </ul>
      <ul className="muted">
        {Object.values(SPECIALS).map((s) => <li key={s.name}><b>{s.name}</b>: {s.how}</li>)}
      </ul>
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [game, setGame] = useState<GameKind>("lth");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.dataset.level = "1";
    document.body.dataset.theme = "home";
    setName(lastName());
  }, []);

  async function create() {
    setErr("");
    if (!name.trim()) return setErr("ใส่ชื่อที่จะให้เพื่อนเห็นก่อน");
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, game }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      saveName(name.trim());
      router.push(`/room/${j.code}`);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "สร้างห้องไม่สำเร็จ");
      setBusy(false);
    }
  }

  function join() {
    const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!CODE_RE.test(c)) return setErr(`รหัสห้องมี ${CODE_LEN} ตัวอักษร`);
    saveName(name.trim());
    router.push(`/room/${c}`);
  }

  const G = GAMES[game];
  return (
    <main className="wrap home">
      <header className="home-head">
        <h1 className="brand"><span>ลึก</span><span>ทีละ</span><span>ชั้น</span></h1>
        <p className="lede">เกมเล่นกับเพื่อน ทุกคนเล่นจากโทรศัพท์ของตัวเอง เลือกเกม สร้างห้อง แล้วส่งลิงก์ให้เพื่อน</p>
      </header>

      <h2 className="sec" id="pick">เลือกเกม</h2>
      <div className="games" role="radiogroup" aria-labelledby="pick">
        {GAME_KINDS.map((k) => (
          <button key={k} data-g={k} className={`game ${game === k ? "on" : ""}`} role="radio" aria-checked={game === k} onClick={() => setGame(k)}>
            <b>{GAMES[k].name}</b>
            <span>{GAMES[k].desc}</span>
            <em>{GAMES[k].short} · {GAMES[k].players}</em>
          </button>
        ))}
      </div>

      {game === "lth" && (
        <div className="layers">
          {LEVELS.map((l) => (
            <div className="layer" key={l.name}><h3>{l.name}</h3><p>{l.desc}</p></div>
          ))}
        </div>
      )}

      <section className="form" aria-label="สร้างหรือเข้าห้อง">
        <label className="lb" htmlFor="nm">ชื่อของคุณในวง</label>
        <input className="txt" id="nm" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น มิ้นท์" autoComplete="nickname" />
        <button className="btn" style={{ marginTop: 12 }} onClick={create} disabled={busy}>{busy ? "กำลังสร้างห้อง…" : `สร้างห้อง${G.name}`}</button>
        <p className="or">หรือเข้าห้องของเพื่อน (เกมไหนก็ได้)</p>
        <div className="row">
          <input className="txt" id="jc" aria-label="รหัสห้อง" maxLength={CODE_LEN} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={`รหัส ${CODE_LEN} ตัว`} autoCapitalize="characters" autoComplete="off" style={{ letterSpacing: ".15em" }}
            onKeyDown={(e) => e.key === "Enter" && join()} />
          <button className="btn ghost" onClick={join}>เข้าห้อง</button>
        </div>
        {err && <p className="note" role="alert">{err}</p>}
      </section>

      <details>
        <summary>วิธีเล่น{G.name}</summary>
        <Rules game={game} />
      </details>
    </main>
  );
}
