"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CODE_LEN, CODE_RE, LEVELS, lastName, saveName } from "@/lib/ui";
import { NEED_FRONT, SPECIALS } from "@/lib/engine";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.dataset.level = "1";
    setName(lastName());
  }, []);

  async function create() {
    setErr("");
    if (!name.trim()) return setErr("ใส่ชื่อที่จะให้เพื่อนเห็นก่อน");
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
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

  return (
    <main className="wrap">
      <h1 className="title"><span>ลึก</span><span>ทีละ</span><span>ชั้น</span></h1>
      <p className="lede">การ์ดชวนคุย 147 ใบ สามระดับ ทุกคนเล่นจากโทรศัพท์ของตัวเอง แค่สร้างห้องแล้วส่งลิงก์ให้เพื่อน</p>
      <div className="layers">
        {LEVELS.map((l) => (
          <div className="layer" key={l.name}><h3>{l.name}</h3><p>{l.desc}</p></div>
        ))}
      </div>
      <div className="stack">
        <div>
          <label className="lb" htmlFor="nm">ชื่อของคุณในวง</label>
          <input className="txt" id="nm" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น มิ้นท์" />
        </div>
        <button className="btn" onClick={create} disabled={busy}>{busy ? "กำลังสร้างห้อง…" : "สร้างห้องใหม่"}</button>
        <div>
          <label className="lb" htmlFor="jc">หรือเข้าห้องของเพื่อน</label>
          <div className="row">
            <input className="txt" id="jc" maxLength={CODE_LEN} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={`รหัส ${CODE_LEN} ตัว`} autoCapitalize="characters" style={{ letterSpacing: ".15em" }}
              onKeyDown={(e) => e.key === "Enter" && join()} />
            <button className="btn ghost" onClick={join}>เข้าห้อง</button>
          </div>
        </div>
      </div>
      {err && <p className="note" role="alert">{err}</p>}
      <details>
        <summary>วิธีเล่น</summary>
        <ol>
          <li>ทุกคนได้การ์ดคำถาม 5 ใบ และการ์ด<b>ผ่าน</b> 1 ใบ</li>
          <li>ถึงตาใคร ให้เลือกการ์ดคำถามหนึ่งใบ แล้วเลือกคนที่จะถาม</li>
          <li>คนถูกถามตอบ หรือใช้การ์ดผ่านได้โดยไม่ต้องอธิบาย การ์ดที่ตอบแล้วจะไปวางตรงหน้าคนตอบ</li>
          <li>การ์ดคำถามทุกใบมีเชือกหนึ่งในหกสี ใครได้การ์ดที่มีเชือก<b>สีที่วงยังไม่มี</b>ในชั้นนี้ จะได้การ์ดพิเศษเพิ่ม 1 ใบ</li>
          <li>วงดำลงชั้นถัดไปเมื่อ<b>การ์ดตรงหน้าทุกคนรวมกันมีเชือกครบ 6 สี</b> หรือ<b>ทุกคนมีการ์ดตรงหน้าครบ {NEED_FRONT} ใบ</b></li>
          <li>จบชั้นก้นทะเลเมื่อไหร่ ก็จบรอบ</li>
        </ol>
        <ul className="muted">
          {Object.values(SPECIALS).map((s) => <li key={s.name}><b>{s.name}</b>: {s.how}</li>)}
        </ul>
      </details>
    </main>
  );
}
