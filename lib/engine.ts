// กติกาเกมทั้งหมดอยู่ที่นี่ เป็นฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// เซิร์ฟเวอร์เรียก applyAction แล้วบันทึกผลลงตาราง rooms

export const HAND_SIZE = 5;
export const NEED_FRONT = 3;
export const MAX_PLAYERS = 6;
export const ROPE_COUNT = 6;

export type Special = "buddy" | "double" | "all";
export type QRef = { id: number; rope: number; sp?: boolean }; // sp = คำถามโหมดทะลึ่ง 18+
export type QCard = { kind: "q"; id: number; lv: number; rope: number; sp?: boolean };
export type SCard = { kind: "s"; s: Special };
export type Card = QCard | SCard;

export type Player = {
  id: string;
  name: string;
  hand: Card[];
  pass: boolean;
  front: QCard[];
};

export type Pending = {
  asker: number;
  handIndex: number;
  card: QCard;
  targets: number[];
  res: (0 | 1 | 2)[]; // 0 กำลังตอบ, 1 ตอบแล้ว, 2 ผ่าน
  buddyUsed: boolean;
  special: Special | null;
};

export type GameEvent =
  | { n: number; type: "bonus"; player: string; rope: number; special: Special }
  | { n: number; type: "levelup"; level: number; reason: "ropes" | "front" | "host" };

export type Phase = "lobby" | "play" | "up" | "end";

export type GameState = {
  game?: "lth"; // ห้องเก่าที่สร้างก่อนมีหลายเกมไม่มีช่องนี้ ถือเป็น lth
  phase: Phase;
  level: number;
  hostId: string;
  players: Player[];
  current: number;
  pending: Pending | null;
  decks: QRef[][];
  events: GameEvent[];
  eventSeq: number;
  locked: boolean; // ปิดรับคนเข้าห้องเพิ่ม
  spicy?: boolean; // โหมดทะลึ่ง 18+
};

export type Pools = QRef[][]; // คำถามทั้งหมดของแต่ละระดับ โหลดจาก Supabase

export type Action =
  | { type: "start" }
  | { type: "ask"; handIndex: number; cardId?: number; targets: number[]; useDouble?: boolean; useAll?: boolean }
  | { type: "answer" }
  | { type: "pass" }
  | { type: "buddy"; to: number }
  | { type: "skip" }
  | { type: "deeper" }
  | { type: "next" }
  | { type: "again" }
  | { type: "kick"; player: number }
  | { type: "lock"; locked: boolean }
  | { type: "spicy"; on: boolean };

export class GameError extends Error {}

export const SPECIALS: Record<Special, { name: string; how: string }> = {
  buddy: { name: "ชวนเพื่อน", how: "ใช้ตอนถูกถาม เลือกอีกคนให้ตอบคำถามเดียวกัน" },
  double: { name: "เพิ่มคน", how: "ใช้ตอนถาม เลือกคนตอบเพิ่มอีก 1 คน" },
  all: { name: "ทั้งวง", how: "ใช้ตอนถาม ทุกคนในวงตอบ รวมถึงคุณ" },
};

/* ---------- helpers ---------- */
function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
// การ์ดพิเศษได้จากเชือกสีใหม่เท่านั้น และไม่ซ้ำกับที่มีในมือ จนกว่าจะมีครบทุกแบบแล้ว
function pickSpecial(p: Player, playerCount: number): Special {
  const pool: Special[] = playerCount >= 3 ? ["buddy", "double", "all"] : ["buddy", "all"];
  const missing = pool.filter((s) => !p.hand.some((c) => c.kind === "s" && c.s === s));
  const from = missing.length ? missing : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// คำถามทะลึ่งเข้ากองเฉพาะห้องที่เปิดโหมด 18+
const poolOf = (st: GameState, pools: Pools, lv: number) => pools[lv].filter((q) => st.spicy || !q.sp);
function drawQuestion(st: GameState, pools: Pools): QCard {
  const lv = st.level;
  if (!st.decks[lv] || st.decks[lv].length === 0) st.decks[lv] = shuffle(poolOf(st, pools, lv));
  const q = st.decks[lv].pop();
  if (!q) throw new GameError("ยังไม่มีคำถามในระดับนี้ ตรวจตาราง questions");
  return q.sp ? { kind: "q", id: q.id, lv, rope: q.rope, sp: true } : { kind: "q", id: q.id, lv, rope: q.rope };
}
// การ์ดคำถามในมือเติมให้ครบ 5 ใบเสมอ การ์ดพิเศษไม่กินที่
function refill(st: GameState, p: Player, pools: Pools) {
  while (p.hand.filter((c) => c.kind === "q").length < HAND_SIZE) p.hand.push(drawQuestion(st, pools));
}
type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, "n"> : never) : never;
function pushEvent(st: GameState, e: NewEvent) {
  st.eventSeq += 1;
  st.events = [...st.events, { ...e, n: st.eventSeq } as GameEvent].slice(-8);
}
function removeSpecial(p: Player, s: Special): boolean {
  const i = p.hand.findIndex((c) => c.kind === "s" && c.s === s);
  if (i < 0) return false;
  p.hand.splice(i, 1);
  return true;
}
const hasSpecial = (p: Player, s: Special) => p.hand.some((c) => c.kind === "s" && c.s === s);

export function tableRopes(st: { players: { front: QCard[] }[] }): Set<number> {
  const set = new Set<number>();
  st.players.forEach((p) => p.front.forEach((c) => set.add(c.rope)));
  return set;
}
function levelDoneReason(st: GameState): "ropes" | "front" | null {
  if (tableRopes(st).size >= ROPE_COUNT) return "ropes";
  if (st.players.every((p) => p.front.length >= NEED_FRONT)) return "front";
  return null;
}

/* ---------- lifecycle ---------- */
export function createState(hostId: string, hostName: string): GameState {
  return {
    game: "lth",
    phase: "lobby",
    level: 0,
    hostId,
    players: [{ id: hostId, name: hostName, hand: [], pass: true, front: [] }],
    current: 0,
    pending: null,
    decks: [[], [], []],
    events: [],
    eventSeq: 0,
    locked: false,
  };
}

export function addPlayer(st: GameState, id: string, name: string, pools: Pools): GameState {
  const s = structuredClone(st);
  const existing = s.players.find((p) => p.id === id);
  if (existing) {
    if (s.phase === "lobby") existing.name = name;
    return s;
  }
  if (s.locked) throw new GameError("เจ้าของห้องปิดรับคนเพิ่มแล้ว");
  if (s.players.length >= MAX_PLAYERS) throw new GameError("ห้องนี้เต็มแล้ว (6 คน)");
  const p: Player = { id, name, hand: [], pass: true, front: [] };
  s.players.push(p);
  if (s.phase === "play" || s.phase === "up") refill(s, p, pools);
  return s;
}

function deal(st: GameState, pools: Pools) {
  st.level = 0;
  st.decks = [0, 1, 2].map((lv) => shuffle(poolOf(st, pools, lv)));
  st.current = 0;
  st.pending = null;
  st.events = [];
  st.players.forEach((p) => {
    p.hand = [];
    p.pass = true;
    p.front = [];
    refill(st, p, pools);
  });
  st.phase = "play";
}

function nextLevel(st: GameState, pools: Pools) {
  st.level += 1;
  st.pending = null;
  st.players.forEach((p) => {
    p.pass = true;
    p.front = [];
    p.hand = p.hand.filter((c) => c.kind === "s"); // การ์ดพิเศษเก็บไว้ได้
    refill(st, p, pools);
  });
  st.phase = "play";
}

function endLevel(st: GameState, reason: "ropes" | "front" | "host") {
  st.pending = null;
  pushEvent(st, { type: "levelup", level: st.level, reason });
  st.phase = st.level < 2 ? "up" : "end";
}

function finalize(st: GameState, pools: Pools) {
  const q = st.pending!;
  const asker = st.players[q.asker];

  // การ์ดไปวางตรงหน้าคนแรกที่ตอบ
  const k = q.targets.findIndex((_, m) => q.res[m] === 1);
  if (k > -1) {
    const receiver = st.players[q.targets[k]];
    const ropesBefore = tableRopes(st);
    receiver.front.push(q.card);
    // กติกาเสริม: ได้เชือกสีใหม่ของวงในชั้นนี้ รับการ์ดพิเศษเพิ่ม 1 ใบ
    // ยกเว้นใบที่ทำให้จบชั้นพอดี (เช่นเชือกสีที่ 6) ไม่งั้นจะดูเหมือนได้การ์ดพิเศษฟรีตอนขึ้นชั้นใหม่
    if (!ropesBefore.has(q.card.rope) && !levelDoneReason(st)) {
      const special = pickSpecial(receiver, st.players.length);
      receiver.hand.push({ kind: "s", s: special });
      pushEvent(st, { type: "bonus", player: receiver.id, rope: q.card.rope, special });
    }
  }

  let hi = q.handIndex;
  const at = asker.hand[hi];
  if (!(at && at.kind === "q" && at.id === q.card.id)) hi = asker.hand.findIndex((c) => c.kind === "q" && c.id === q.card.id);
  if (hi > -1) asker.hand.splice(hi, 1);
  if (q.special) removeSpecial(asker, q.special);
  refill(st, asker, pools);
  st.pending = null;

  const reason = levelDoneReason(st);
  if (reason) endLevel(st, reason);
  else st.current = (q.asker + 1) % st.players.length;
}

/* ---------- actions ---------- */
export function applyAction(prev: GameState, playerId: string, a: Action, pools: Pools): GameState {
  const st = structuredClone(prev);
  const i = st.players.findIndex((p) => p.id === playerId);
  if (i < 0) throw new GameError("คุณยังไม่ได้อยู่ในห้องนี้");
  const me = st.players[i];
  const isHost = playerId === st.hostId;
  const P = st.players;

  switch (a.type) {
    case "start":
      if (!isHost) throw new GameError("เฉพาะเจ้าของห้องที่เริ่มเกมได้");
      if (st.phase !== "lobby") throw new GameError("เกมเริ่มไปแล้ว");
      if (P.length < 2) throw new GameError("ต้องมีผู้เล่นอย่างน้อย 2 คน");
      deal(st, pools);
      break;

    case "ask": {
      if (st.phase !== "play" || st.pending) throw new GameError("ตอนนี้ยังถามไม่ได้");
      if (st.current !== i) throw new GameError("ยังไม่ถึงตาคุณ");
      const card = me.hand[a.handIndex];
      if (!card || card.kind !== "q") throw new GameError("เลือกการ์ดคำถามก่อน");
      if (a.cardId !== undefined && card.id !== a.cardId) throw new GameError("ไพ่ในมือเปลี่ยนไปแล้ว ลองเลือกใหม่");
      let targets: number[];
      let special: Special | null = null;
      if (a.useAll && hasSpecial(me, "all")) {
        targets = [];
        for (let m = 1; m <= P.length; m++) targets.push((i + m) % P.length);
        special = "all";
      } else {
        targets = [...new Set((a.targets || []).filter((j) => j !== i && P[j]))];
        const dbl = !!a.useDouble && hasSpecial(me, "double") && P.length >= 3;
        if (targets.length !== (dbl ? 2 : 1)) throw new GameError(dbl ? "เลือกคนที่จะถาม 2 คน" : "เลือกคนที่จะถาม 1 คน");
        if (dbl) special = "double";
      }
      st.pending = { asker: i, handIndex: a.handIndex, card, targets, res: targets.map(() => 0), buddyUsed: false, special };
      break;
    }

    case "answer":
    case "pass": {
      const q = st.pending;
      if (!q) throw new GameError("ไม่มีคำถามที่รอตอบ");
      const k = q.targets.indexOf(i);
      if (k < 0 || q.res[k]) throw new GameError("คำถามนี้ไม่ได้รอคุณตอบ");
      if (a.type === "pass") {
        if (!me.pass) throw new GameError("คุณใช้การ์ดผ่านไปแล้วในชั้นนี้");
        me.pass = false;
        q.res[k] = 2;
      } else q.res[k] = 1;
      if (q.res.every(Boolean)) finalize(st, pools);
      break;
    }

    case "buddy": {
      const q = st.pending;
      if (!q || q.buddyUsed) throw new GameError("ใช้การ์ดชวนเพื่อนตอนนี้ไม่ได้");
      const k = q.targets.indexOf(i);
      if (k < 0 || q.res[k]) throw new GameError("คำถามนี้ไม่ได้รอคุณตอบ");
      if (!P[a.to] || q.targets.includes(a.to)) throw new GameError("เลือกคนที่ยังไม่ได้ตอบคำถามนี้");
      if (!removeSpecial(me, "buddy")) throw new GameError("คุณไม่มีการ์ดชวนเพื่อน");
      refill(st, me, pools);
      q.targets.push(a.to);
      q.res.push(0);
      q.buddyUsed = true;
      break;
    }

    case "skip":
      if (st.phase !== "play") throw new GameError("ข้ามตาได้เฉพาะระหว่างเล่น");
      if (!isHost && st.current !== i) throw new GameError("เฉพาะเจ้าของห้องหรือคนที่ถึงตาเท่านั้นที่ข้ามได้");
      st.pending = null;
      st.current = (st.current + 1) % P.length;
      break;

    case "deeper":
      if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง");
      if (st.phase !== "play") throw new GameError("ตอนนี้ข้ามชั้นไม่ได้");
      endLevel(st, "host");
      break;

    case "next":
      if (st.phase !== "up") throw new GameError("ยังไม่จบชั้นนี้");
      nextLevel(st, pools);
      break;

    case "again":
      if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง");
      if (st.phase !== "end") throw new GameError("รอบนี้ยังไม่จบ");
      deal(st, pools);
      break;

    case "kick": {
      if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง");
      const j = a.player;
      if (!P[j] || P[j].id === st.hostId) throw new GameError("เลือกผู้เล่นที่จะเชิญออกไม่ถูกต้อง");
      st.pending = null;
      P.splice(j, 1);
      if (st.phase !== "lobby" && P.length < 2) st.phase = "lobby";
      if (j < st.current) st.current -= 1;
      if (st.current >= P.length) st.current = 0;
      break;
    }

    case "lock":
      if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง");
      st.locked = !!a.locked;
      break;

    case "spicy":
      if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง");
      if (st.phase !== "lobby" && st.phase !== "end") throw new GameError("เปิดปิดโหมดทะลึ่งได้ก่อนเริ่มรอบเท่านั้น");
      st.spicy = !!a.on;
      break;

    default:
      throw new GameError("ไม่รู้จักการกระทำนี้");
  }
  return st;
}

/* ---------- มุมมองสาธารณะ ----------
   ส่วนนี้เท่านั้นที่ส่งให้ทุกคนในห้องผ่าน Realtime
   ไม่มีไพ่ในมือ ไม่มีลำดับกองไพ่ */
export type PublicPlayer = { id: string; name: string; pass: boolean; front: QCard[]; handCount: number };
export type GameView = {
  game: "lth";
  phase: Phase;
  level: number;
  hostId: string;
  current: number;
  locked: boolean;
  spicy: boolean;
  players: PublicPlayer[];
  pending: Omit<Pending, "handIndex"> | null;
  events: GameEvent[];
  eventSeq: number;
};

export function toView(st: GameState): GameView {
  return {
    game: "lth",
    phase: st.phase,
    level: st.level,
    hostId: st.hostId,
    current: st.current,
    locked: st.locked,
    spicy: !!st.spicy,
    players: st.players.map((p) => ({ id: p.id, name: p.name, pass: p.pass, front: p.front, handCount: p.hand.length })),
    pending: st.pending
      ? { asker: st.pending.asker, card: st.pending.card, targets: st.pending.targets, res: st.pending.res, buddyUsed: st.pending.buddyUsed, special: st.pending.special }
      : null,
    events: st.events,
    eventSeq: st.eventSeq,
  };
}
