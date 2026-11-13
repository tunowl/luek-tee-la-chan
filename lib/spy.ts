// สายลับในวง: ทุกคนรู้สถานที่เดียวกัน ยกเว้นสายลับ ถามตอบกันเพื่อจับตัว ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// (ใช้ Date.now() สำหรับนาฬิกาจับเวลา ซึ่งรันบนเซิร์ฟเวอร์เท่านั้น)
import { GameError } from "./engine";

export const SPY_MIN = 3;
export const SPY_MAX = 12;

export const LOCATIONS: { name: string; roles: string[] }[] = [
  { name: "สนามบิน", roles: ["นักบิน", "แอร์โฮสเตส", "ผู้โดยสารชั้นธุรกิจ", "เจ้าหน้าที่ตรวจคนเข้าเมือง", "ช่างเครื่อง", "พนักงานเช็คอิน", "คนขายของปลอดภาษี"] },
  { name: "โรงพยาบาล", roles: ["หมอ", "พยาบาล", "คนไข้", "ญาติคนไข้", "เภสัชกร", "ศัลยแพทย์", "พนักงานเข็นเปล"] },
  { name: "โรงเรียน", roles: ["ครูใหญ่", "ครูพละ", "นักเรียน", "ภารโรง", "แม่ค้าโรงอาหาร", "ผู้ปกครอง", "ครูฝึกสอน"] },
  { name: "ชายหาด", roles: ["ไลฟ์การ์ด", "นักท่องเที่ยว", "คนขายมะพร้าว", "ช่างภาพ", "คนเล่นเซิร์ฟ", "เด็กก่อปราสาททราย", "หมอนวด"] },
  { name: "ตลาดนัด", roles: ["แม่ค้าผลไม้", "คนขายเสื้อผ้า", "นักท่องเที่ยว", "รปภ.", "คนต่อราคา", "คนขายไก่ทอด", "คนเก็บค่าแผง"] },
  { name: "วัด", roles: ["พระ", "เณร", "ลูกศิษย์วัด", "คนมาทำบุญ", "นักท่องเที่ยว", "คนขายดอกไม้ธูปเทียน", "หมอดู"] },
  { name: "ห้างสรรพสินค้า", roles: ["พนักงานขาย", "รปภ.", "แคชเชียร์", "ลูกค้าขาช้อป", "เด็กหลงทาง", "แม่บ้านทำความสะอาด", "ผู้จัดการ"] },
  { name: "โรงภาพยนตร์", roles: ["คนขายป๊อปคอร์น", "คนฉายหนัง", "คนดูหนัง", "คู่รักมาเดท", "พนักงานตรวจตั๋ว", "นักวิจารณ์หนัง", "เด็กร้องไห้"] },
  { name: "สถานีตำรวจ", roles: ["ตำรวจสายตรวจ", "ผู้ต้องหา", "ทนาย", "นักข่าว", "คนมาแจ้งความ", "สารวัตร", "คนส่งข้าว"] },
  { name: "ร้านกาแฟ", roles: ["บาริสต้า", "ลูกค้าประจำ", "ฟรีแลนซ์", "คนส่งของ", "เจ้าของร้าน", "บล็อกเกอร์รีวิว", "นักศึกษาอ่านหนังสือ"] },
  { name: "รถไฟ", roles: ["พนักงานตรวจตั๋ว", "คนขับรถไฟ", "ผู้โดยสาร", "คนขายข้าวเหนียวไก่", "แบ็คแพ็คเกอร์", "คนนอนหลับ", "ช่างซ่อมราง"] },
  { name: "โรงแรม", roles: ["พนักงานต้อนรับ", "แม่บ้าน", "เบลล์บอย", "คู่ฮันนีมูน", "เชฟ", "ผู้จัดการ", "แขกนักธุรกิจ"] },
  { name: "ร้านหมูกระทะ", roles: ["เจ้าของร้าน", "เด็กเสิร์ฟ", "ลูกค้าวงเหล้า", "คนเติมถ่าน", "นักร้องดนตรีสด", "สายบุฟเฟต์", "แคชเชียร์"] },
  { name: "ฟิตเนส", roles: ["เทรนเนอร์", "คนยกเวท", "คนเล่นโยคะ", "มือใหม่", "พนักงานต้อนรับ", "คนวิ่งลู่", "เจ้าของยิม"] },
  { name: "สวนสัตว์", roles: ["ผู้ดูแลช้าง", "สัตวแพทย์", "นักท่องเที่ยว", "เด็กทัศนศึกษา", "คนขายไอศกรีม", "ช่างภาพ", "ไกด์"] },
  { name: "งานแต่งงาน", roles: ["เจ้าบ่าว", "เจ้าสาว", "เพื่อนเจ้าสาว", "พิธีกร", "ช่างภาพ", "แขกที่ไม่รู้จักใคร", "ญาติผู้ใหญ่"] },
  { name: "คอนเสิร์ต", roles: ["นักร้อง", "มือกลอง", "แฟนคลับ", "การ์ด", "ซาวด์เอนจิเนียร์", "คนขายเสื้อวง", "ช่างไฟ"] },
  { name: "ธนาคาร", roles: ["พนักงานเคาน์เตอร์", "ผู้จัดการสาขา", "ลูกค้ามากู้เงิน", "รปภ.", "คนขนเงิน", "ลูกค้ารอคิว", "โจรปล้นธนาคาร"] },
  { name: "เรือสำราญ", roles: ["กัปตัน", "ลูกเรือ", "นักดนตรี", "ผู้โดยสาร", "เชฟ", "คนเมาเรือ", "หมอประจำเรือ"] },
  { name: "สถานีอวกาศ", roles: ["นักบินอวกาศ", "วิศวกร", "นักวิทยาศาสตร์", "หมอ", "ผู้บัญชาการ", "นักท่องเที่ยวอวกาศ", "มนุษย์ต่างดาว"] },
  { name: "ร้านเสริมสวย", roles: ["ช่างตัดผม", "ช่างทำเล็บ", "ลูกค้าทำสีผม", "เจ้าของร้าน", "ลูกค้ารอคิว", "เด็กฝึกงาน", "คนมาส่งของ"] },
  { name: "กองถ่ายละคร", roles: ["ผู้กำกับ", "นางเอก", "พระเอก", "ตัวประกอบ", "ช่างแต่งหน้า", "คนเขียนบท", "ช่างกล้อง"] },
];

export type SpyPhase = "lobby" | "play" | "accuse" | "final" | "end";
export type SpyPlayer = { id: string; name: string; role: string | null; spy: boolean; playing: boolean; accused: boolean; score: number };
export type Accusation = { by: string; target: string; votes: Record<string, boolean> };
export type SpyResult = {
  winner: "spy" | "village";
  reason: "caught" | "wrong" | "guessed" | "missed" | "final-caught" | "final-wrong" | "host";
  spyId: string;
  location: number;
  accused: string | null;
  guess: number | null;
};

export type SpyState = {
  game: "spy";
  phase: SpyPhase;
  hostId: string;
  locked: boolean;
  players: SpyPlayer[];
  minutes: number;
  location: number;
  first: string; // คนเริ่มถามก่อน
  endsAt: number; // ms
  pausedLeft: number | null; // เวลาที่เหลือตอนหยุดนาฬิกา
  accusation: Accusation | null;
  finalVotes: Record<string, string>;
  result: SpyResult | null;
  round: number;
};

export type SpyAction =
  | { type: "start" }
  | { type: "minutes"; minutes: number }
  | { type: "accuse"; target: string }
  | { type: "verdict"; yes: boolean }
  | { type: "guess"; location: number }
  | { type: "timeup" }
  | { type: "vote"; target: string | null }
  | { type: "reveal" }
  | { type: "again" }
  | { type: "reset" }
  | { type: "kick"; player: number }
  | { type: "lock"; locked: boolean };

const rnd = (n: number) => Math.floor(Math.random() * n);
function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const inRound = (st: SpyState) => st.players.filter((p) => p.playing);
const spyOf = (st: SpyState) => st.players.find((p) => p.spy)!;

function deal(st: SpyState) {
  st.round += 1;
  st.location = rnd(LOCATIONS.length);
  const roles = shuffle(LOCATIONS[st.location].roles);
  const spyAt = rnd(st.players.length);
  st.players.forEach((p, k) => {
    p.playing = true;
    p.accused = false;
    p.spy = k === spyAt;
    p.role = p.spy ? null : roles[k % roles.length];
  });
  st.first = st.players[rnd(st.players.length)].id;
  st.endsAt = Date.now() + st.minutes * 60_000;
  st.pausedLeft = null;
  st.accusation = null;
  st.finalVotes = {};
  st.result = null;
  st.phase = "play";
}

function finish(st: SpyState, winner: "spy" | "village", reason: SpyResult["reason"], accused: string | null = null, guess: number | null = null) {
  const spy = spyOf(st);
  st.result = { winner, reason, spyId: spy.id, location: st.location, accused, guess };
  if (winner === "spy") spy.score += reason === "guessed" ? 4 : 2;
  else inRound(st).forEach((p) => { if (!p.spy) p.score += 1; });
  st.accusation = null;
  st.pausedLeft = null;
  st.phase = "end";
}

function pauseClock(st: SpyState) {
  if (st.pausedLeft === null) st.pausedLeft = Math.max(0, st.endsAt - Date.now());
}
function resumeClock(st: SpyState) {
  if (st.pausedLeft !== null) { st.endsAt = Date.now() + st.pausedLeft; st.pausedLeft = null; }
}

// ข้อกล่าวหาผ่านเมื่อทุกคนที่เหลือ (ยกเว้นคนถูกกล่าวหา) เห็นด้วย
function settleAccusation(st: SpyState) {
  const acc = st.accusation!;
  const voters = inRound(st).filter((p) => p.id !== acc.target);
  if (voters.some((p) => acc.votes[p.id] === false)) {
    st.accusation = null;
    st.phase = "play";
    resumeClock(st);
    return;
  }
  if (voters.every((p) => acc.votes[p.id] === true)) {
    const t = st.players.find((p) => p.id === acc.target)!;
    if (t.spy) finish(st, "village", "caught", t.id);
    else finish(st, "spy", "wrong", t.id);
  }
}

function settleFinal(st: SpyState) {
  const ps = inRound(st);
  if (!ps.every((p) => st.finalVotes[p.id])) return;
  const count: Record<string, number> = {};
  Object.values(st.finalVotes).forEach((t) => (count[t] = (count[t] || 0) + 1));
  const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]);
  const [topId, topN] = ranked[0];
  const tie = ranked.length > 1 && ranked[1][1] === topN;
  const spy = spyOf(st);
  if (!tie && topId === spy.id) finish(st, "village", "final-caught", topId);
  else finish(st, "spy", "final-wrong", tie ? null : topId);
}

export function createSpy(hostId: string, hostName: string): SpyState {
  return {
    game: "spy",
    phase: "lobby",
    hostId,
    locked: false,
    players: [{ id: hostId, name: hostName, role: null, spy: false, playing: false, accused: false, score: 0 }],
    minutes: 8,
    location: 0,
    first: hostId,
    endsAt: 0,
    pausedLeft: null,
    accusation: null,
    finalVotes: {},
    result: null,
    round: 0,
  };
}

export function addSpyPlayer(prev: SpyState, id: string, name: string): SpyState {
  const st = structuredClone(prev);
  const ex = st.players.find((p) => p.id === id);
  if (ex) {
    if (st.phase === "lobby") ex.name = name;
    return st;
  }
  if (st.locked) throw new GameError("เจ้าของห้องปิดรับคนเพิ่มแล้ว");
  if (st.players.length >= SPY_MAX) throw new GameError(`ห้องนี้เต็มแล้ว (${SPY_MAX} คน)`);
  // เข้ามากลางรอบ = รอรอบถัดไป
  st.players.push({ id, name, role: null, spy: false, playing: false, accused: false, score: 0 });
  return st;
}

export function applySpy(prev: SpyState, playerId: string, a: SpyAction): SpyState {
  const st = structuredClone(prev);
  const me = st.players.find((p) => p.id === playerId);
  if (!me) throw new GameError("คุณยังไม่ได้อยู่ในห้องนี้");
  const isHost = playerId === st.hostId;
  const hostOnly = () => { if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง"); };
  const mustPlay = () => { if (!me.playing) throw new GameError("คุณรอเล่นรอบถัดไป"); };

  switch (a.type) {
    case "minutes":
      hostOnly();
      if (st.phase !== "lobby" && st.phase !== "end") throw new GameError("ตั้งเวลาได้ระหว่างรอเริ่มรอบ");
      st.minutes = Math.min(15, Math.max(3, a.minutes));
      break;

    case "start":
      hostOnly();
      if (st.phase !== "lobby") throw new GameError("เกมเริ่มไปแล้ว");
      if (st.players.length < SPY_MIN) throw new GameError(`ต้องมีผู้เล่นอย่างน้อย ${SPY_MIN} คน`);
      st.players.forEach((p) => (p.score = 0));
      deal(st);
      break;

    case "accuse": {
      mustPlay();
      if (st.phase !== "play") throw new GameError("ตอนนี้กล่าวหาไม่ได้");
      if (me.accused) throw new GameError("คุณกล่าวหาไปแล้วในรอบนี้ (คนละครั้ง)");
      const t = inRound(st).find((p) => p.id === a.target);
      if (!t || t.id === me.id) throw new GameError("เลือกคนที่จะกล่าวหา");
      me.accused = true;
      pauseClock(st);
      st.accusation = { by: me.id, target: t.id, votes: { [me.id]: true } };
      st.phase = "accuse";
      settleAccusation(st);
      break;
    }

    case "verdict": {
      mustPlay();
      if (st.phase !== "accuse" || !st.accusation) throw new GameError("ไม่มีข้อกล่าวหาที่รอโหวต");
      if (st.accusation.target === me.id) throw new GameError("คนถูกกล่าวหาไม่ได้โหวต");
      st.accusation.votes[me.id] = !!a.yes;
      settleAccusation(st);
      break;
    }

    case "guess": {
      mustPlay();
      if (!me.spy) throw new GameError("เฉพาะสายลับที่ทายสถานที่ได้");
      if (st.phase !== "play" && st.phase !== "accuse" && st.phase !== "final") throw new GameError("ตอนนี้ทายไม่ได้");
      if (!LOCATIONS[a.location]) throw new GameError("เลือกสถานที่");
      if (a.location === st.location) finish(st, "spy", "guessed", null, a.location);
      else finish(st, "village", "missed", null, a.location);
      break;
    }

    case "timeup":
      mustPlay();
      if (st.phase !== "play") throw new GameError("ตอนนี้ยังไม่หมดเวลา");
      if (Date.now() < st.endsAt - 1500) throw new GameError("ยังไม่หมดเวลา");
      st.phase = "final";
      st.finalVotes = {};
      break;

    case "vote": {
      mustPlay();
      if (st.phase !== "final") throw new GameError("ยังไม่ถึงตอนโหวตสุดท้าย");
      if (a.target === null) { delete st.finalVotes[me.id]; break; }
      const t = inRound(st).find((p) => p.id === a.target);
      if (!t || t.id === me.id) throw new GameError("เลือกคนที่คิดว่าเป็นสายลับ");
      st.finalVotes[me.id] = t.id;
      settleFinal(st);
      break;
    }

    case "reveal":
      hostOnly();
      if (st.phase === "lobby" || st.phase === "end") throw new GameError("ไม่มีรอบที่กำลังเล่น");
      st.result = { winner: "village", reason: "host", spyId: spyOf(st).id, location: st.location, accused: null, guess: null };
      st.accusation = null;
      st.phase = "end";
      break;

    case "again":
      hostOnly();
      if (st.phase !== "end") throw new GameError("รอบนี้ยังไม่จบ");
      if (st.players.length < SPY_MIN) throw new GameError(`ต้องมีผู้เล่นอย่างน้อย ${SPY_MIN} คน`);
      deal(st);
      break;

    case "reset":
      hostOnly();
      st.phase = "lobby";
      st.result = null;
      st.accusation = null;
      st.finalVotes = {};
      st.players.forEach((p) => { p.role = null; p.spy = false; p.playing = false; p.accused = false; });
      break;

    case "kick": {
      hostOnly();
      const t = st.players[a.player];
      if (!t || t.id === st.hostId) throw new GameError("เลือกผู้เล่นที่จะเชิญออกไม่ถูกต้อง");
      st.players.splice(a.player, 1);
      const live = st.phase === "play" || st.phase === "accuse" || st.phase === "final";
      if (live && (t.spy || inRound(st).length < SPY_MIN)) {
        // สายลับออกไป หรือคนไม่พอ: เริ่มรอบใหม่ทันที
        if (st.players.length >= SPY_MIN) { st.round -= 1; deal(st); }
        else { st.phase = "lobby"; st.players.forEach((p) => { p.playing = false; p.spy = false; p.role = null; }); }
      } else if (live) {
        delete st.finalVotes[t.id];
        for (const [k, v] of Object.entries(st.finalVotes)) if (v === t.id) delete st.finalVotes[k];
        if (st.first === t.id) st.first = inRound(st)[0].id;
        if (st.accusation) {
          if (st.accusation.target === t.id || st.accusation.by === t.id) { st.accusation = null; st.phase = "play"; resumeClock(st); }
          else { delete st.accusation.votes[t.id]; settleAccusation(st); }
        }
        if (st.phase === "final") settleFinal(st);
      }
      break;
    }

    case "lock":
      hostOnly();
      st.locked = !!a.locked;
      break;

    default:
      throw new GameError("ไม่รู้จักการกระทำนี้");
  }
  return st;
}

/* ---------- มุมมองสาธารณะ: ไม่มีสถานที่ บทบาท หรือตัวสายลับ จนกว่าจะจบรอบ ---------- */
export type SpyPublicPlayer = { id: string; name: string; playing: boolean; accused: boolean; score: number };
export type SpyView = {
  game: "spy";
  phase: SpyPhase;
  hostId: string;
  locked: boolean;
  players: SpyPublicPlayer[];
  minutes: number;
  first: string;
  endsAt: number;
  pausedLeft: number | null;
  accusation: Accusation | null;
  finalVotes: Record<string, string>;
  result: SpyResult | null;
  round: number;
  roles: Record<string, string> | null; // บทบาทของทุกคน เปิดตอนจบรอบ
};
export function spyView(st: SpyState): SpyView {
  const end = st.phase === "end";
  const roles: Record<string, string> = {};
  if (end) st.players.forEach((p) => { if (p.playing) roles[p.id] = p.spy ? "สายลับ" : p.role ?? ""; });
  return {
    game: "spy",
    phase: st.phase,
    hostId: st.hostId,
    locked: st.locked,
    players: st.players.map((p) => ({ id: p.id, name: p.name, playing: p.playing, accused: p.accused, score: p.score })),
    minutes: st.minutes,
    first: st.first,
    endsAt: st.endsAt,
    pausedLeft: st.pausedLeft,
    accusation: st.accusation,
    finalVotes: st.finalVotes,
    result: end ? st.result : null,
    round: st.round,
    roles: end ? roles : null,
  };
}

export type SpyPrivate = { kind: "spy" } | { kind: "agent"; location: number; role: string } | { kind: "none" };
export function spyPrivate(st: SpyState, playerId: string): SpyPrivate {
  const me = st.players.find((p) => p.id === playerId);
  if (!me || !me.playing || st.phase === "lobby") return { kind: "none" };
  if (me.spy) return { kind: "spy" };
  return { kind: "agent", location: st.location, role: me.role ?? "" };
}
