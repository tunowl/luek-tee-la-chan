export const LEVELS = [
  { name: "ผิวน้ำ", desc: "เรื่องเบา ๆ ของโปรด เรื่องฮา คำถามกวน ๆ", strip: "linear-gradient(180deg,var(--c0),var(--c1))" },
  { name: "กลางน้ำ", desc: "มุมมองเรื่องเพื่อน งาน ความรัก และกันและกัน", strip: "linear-gradient(180deg,var(--c1),var(--c2))" },
  { name: "ก้นทะเล", desc: "ความกลัว สิ่งที่ค้างในใจ เรื่องที่ไม่เคยพูด", strip: "linear-gradient(180deg,var(--c2),var(--c3))" },
];
export const ROPES = [
  { n: "แดง", c: "#E0504A" },
  { n: "ส้ม", c: "#F08A3C" },
  { n: "เหลือง", c: "#E2B92E" },
  { n: "เขียว", c: "#4DAA6A" },
  { n: "ฟ้า", c: "#3E9BD6" },
  { n: "ม่วง", c: "#8A5CC7" },
];
export const CODE_LEN = 6;
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// เก็บแค่ชื่อที่เคยใช้ ส่วน token อยู่ใน cookie httpOnly ฝั่งเว็บอ่านไม่ได้
export function lastName(): string {
  try { return localStorage.getItem("lth:name") || ""; } catch { return ""; }
}
export function saveName(n: string) {
  try { localStorage.setItem("lth:name", n); } catch {}
}
