// จดหมายลับ: เกมไพ่ส่งจดหมายถึงเจ้าหญิง กติกาแบบไพ่ 21 ใบ (2–6 คน) ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
import { GameError } from "./engine";

export const LETTER_MIN = 2;
export const LETTER_MAX = 6;
export const TOKENS_TO_WIN: Record<number, number> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 };
export const tokensToWin = (n: number) => TOKENS_TO_WIN[Math.min(6, Math.max(2, n))];

export type LCardInfo = { v: number; name: string; count: number; how: string; target: "other" | "any" | "none" };
export const LCARDS: LCardInfo[] = [
  { v: 0, name: "สายลับ", count: 2, target: "none", how: "ไม่มีผลตอนเล่น จบรอบแล้วถ้าคุณเป็นคนเดียวที่ยังอยู่ในรอบและเคยเล่นหรือทิ้งสายลับ ได้ตราเพิ่ม 1" },
  { v: 1, name: "ทหารยาม", count: 6, target: "other", how: "ทายไพ่ในมือผู้เล่นอื่น 1 คน (ห้ามทายทหารยาม) ทายถูก คนนั้นตกรอบ" },
  { v: 2, name: "นักบวช", count: 2, target: "other", how: "แอบดูไพ่ในมือผู้เล่นอื่น 1 คน" },
  { v: 3, name: "ขุนนาง", count: 2, target: "other", how: "เทียบไพ่ในมือกับผู้เล่นอื่นแบบลับ ๆ ใครแต้มน้อยกว่าตกรอบ" },
  { v: 4, name: "นางกำนัล", count: 2, target: "none", how: "ไม่มีใครเลือกคุณเป็นเป้าหมายได้จนถึงตาถัดไปของคุณ" },
  { v: 5, name: "เจ้าชาย", count: 2, target: "any", how: "เลือกใครก็ได้ (รวมตัวเอง) ให้ทิ้งไพ่ในมือแล้วจั่วใหม่ ถ้าทิ้งเจ้าหญิงจะตกรอบ" },
  { v: 6, name: "ราชเลขา", count: 2, target: "none", how: "จั่วเพิ่ม 2 ใบ เก็บไว้ 1 ใบ ที่เหลือสอดไว้ใต้กอง" },
  { v: 7, name: "กษัตริย์", count: 1, target: "other", how: "แลกไพ่ในมือกับผู้เล่นอื่น 1 คน" },
  { v: 8, name: "เคาน์เตส", count: 1, target: "none", how: "ถ้าในมือมีกษัตริย์หรือเจ้าชายด้วย ต้องเล่นใบนี้" },
  { v: 9, name: "เจ้าหญิง", count: 1, target: "none", how: "ถ้าคุณเล่นหรือทิ้งใบนี้ ไม่ว่าด้วยเหตุใด คุณตกรอบ" },
];
const FULL_DECK: number[] = LCARDS.flatMap((c) => Array<number>(c.count).fill(c.v));

export type LNote = { n: number; kind: "priest" | "baron"; other: string; theirs: number; mine?: number };
export type LPlayer = { id: string; name: string; hand: number[]; discards: number[]; out: boolean; prot: boolean; tokens: number; notes: LNote[] };
export type LRes = "none" | "out" | "safe" | "tie" | "look" | "drew" | "swap" | "draw2" | "self-out" | "protected";
export type LEvent = { n: number; actor: string; card: number; target?: string; guess?: number; res: LRes; outId?: string; outCard?: number; discarded?: number };
export type RoundWin = { ids: string[]; spy: string | null; reason: "last" | "deck"; hands: Record<string, number> };
export type LPhase = "lobby" | "play" | "round" | "end";

export type LetterState = {
  game: "letter";
  phase: LPhase;
  hostId: string;
  locked: boolean;
  players: LPlayer[];
  deck: number[]; // จั่วจากท้าย array, ใต้กองคือต้น array
  aside: number | null;
  faceUp: number[];
  current: number;
  round: number;
  starter: number;
  chancellor: boolean;
  events: LEvent[];
  eventSeq: number;
  roundWin: RoundWin | null;
};

export type LetterAction =
  | { type: "start" }
  | { type: "play"; card: number; target: string | null; guess: number | null }
  | { type: "keep"; card: number }
  | { type: "next" }
  | { type: "again" }
  | { type: "reset" }
  | { type: "kick"; player: number }
  | { type: "lock"; locked: boolean };

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const cardName = (v: number) => LCARDS[v]?.name ?? "?";
export { cardName };

function pushEvent(st: LetterState, e: Omit<LEvent, "n">) {
  st.eventSeq += 1;
  st.events = [...st.events, { ...e, n: st.eventSeq }].slice(-12);
}
function note(st: LetterState, p: LPlayer, n: Omit<LNote, "n">) {
  st.eventSeq += 1;
  p.notes = [...p.notes, { ...n, n: st.eventSeq }].slice(-6);
}
function eliminate(p: LPlayer) {
  p.out = true;
  p.prot = false;
  p.discards.push(...p.hand);
  p.hand = [];
}

function newRound(st: LetterState) {
  st.round += 1;
  st.deck = shuffle(FULL_DECK);
  st.aside = st.deck.pop()!;
  st.faceUp = st.players.length === 2 ? [st.deck.pop()!, st.deck.pop()!, st.deck.pop()!] : [];
  st.players.forEach((p) => {
    p.hand = [st.deck.pop()!];
    p.discards = [];
    p.out = false;
    p.prot = false;
    p.notes = [];
  });
  st.chancellor = false;
  st.roundWin = null;
  st.events = [];
  st.current = Math.min(st.starter, st.players.length - 1);
  st.phase = "play";
  beginTurn(st);
}
function beginTurn(st: LetterState) {
  const p = st.players[st.current];
  p.prot = false;
  if (st.deck.length) p.hand.push(st.deck.pop()!);
}
function roundOver(st: LetterState, ids: string[], reason: "last" | "deck") {
  const alive = st.players.filter((p) => !p.out);
  const spies = alive.filter((p) => p.discards.includes(0));
  const spy = spies.length === 1 ? spies[0].id : null;
  const hands: Record<string, number> = {};
  alive.forEach((p) => { if (p.hand.length) hands[p.id] = p.hand[0]; });
  st.players.forEach((p) => {
    if (ids.includes(p.id)) p.tokens += 1;
    if (p.id === spy) p.tokens += 1;
  });
  st.roundWin = { ids, spy, reason, hands };
  st.chancellor = false;
  const first = st.players.findIndex((p) => p.id === ids[0]);
  st.starter = first > -1 ? first : 0;
  const need = tokensToWin(st.players.length);
  st.phase = st.players.some((p) => p.tokens >= need) ? "end" : "round";
}
function endTurn(st: LetterState) {
  const alive = st.players.filter((p) => !p.out);
  if (alive.length <= 1) return roundOver(st, alive.map((p) => p.id), "last");
  if (st.deck.length === 0) {
    const best = Math.max(...alive.map((p) => p.hand[0] ?? -1));
    return roundOver(st, alive.filter((p) => p.hand[0] === best).map((p) => p.id), "deck");
  }
  let j = st.current;
  do j = (j + 1) % st.players.length; while (st.players[j].out);
  st.current = j;
  beginTurn(st);
}

export function createLetter(hostId: string, hostName: string): LetterState {
  return {
    game: "letter",
    phase: "lobby",
    hostId,
    locked: false,
    players: [{ id: hostId, name: hostName, hand: [], discards: [], out: false, prot: false, tokens: 0, notes: [] }],
    deck: [],
    aside: null,
    faceUp: [],
    current: 0,
    round: 0,
    starter: 0,
    chancellor: false,
    events: [],
    eventSeq: 0,
    roundWin: null,
  };
}

export function addLetterPlayer(prev: LetterState, id: string, name: string): LetterState {
  const st = structuredClone(prev);
  const ex = st.players.find((p) => p.id === id);
  if (ex) {
    if (st.phase === "lobby") ex.name = name;
    return st;
  }
  if (st.locked) throw new GameError("เจ้าของห้องปิดรับคนเพิ่มแล้ว");
  if (st.players.length >= LETTER_MAX) throw new GameError(`ห้องนี้เต็มแล้ว (${LETTER_MAX} คน)`);
  // เข้ามากลางรอบ = รอรอบถัดไป (out ไว้ก่อน)
  st.players.push({ id, name, hand: [], discards: [], out: st.phase !== "lobby", prot: false, tokens: 0, notes: [] });
  return st;
}

export function applyLetter(prev: LetterState, playerId: string, a: LetterAction): LetterState {
  const st = structuredClone(prev);
  const i = st.players.findIndex((p) => p.id === playerId);
  if (i < 0) throw new GameError("คุณยังไม่ได้อยู่ในห้องนี้");
  const me = st.players[i];
  const P = st.players;
  const isHost = playerId === st.hostId;
  const hostOnly = () => { if (!isHost) throw new GameError("เฉพาะเจ้าของห้อง"); };

  switch (a.type) {
    case "start":
      hostOnly();
      if (st.phase !== "lobby") throw new GameError("เกมเริ่มไปแล้ว");
      if (P.length < LETTER_MIN) throw new GameError("ต้องมีผู้เล่นอย่างน้อย 2 คน");
      P.forEach((p) => (p.tokens = 0));
      st.round = 0;
      st.starter = Math.floor(Math.random() * P.length);
      newRound(st);
      break;

    case "play": {
      if (st.phase !== "play" || st.chancellor) throw new GameError("ตอนนี้เล่นไพ่ไม่ได้");
      if (st.current !== i) throw new GameError("ยังไม่ถึงตาคุณ");
      const c = a.card;
      const at = me.hand.indexOf(c);
      if (at < 0) throw new GameError("คุณไม่มีไพ่ใบนี้ในมือ");
      if (c !== 8 && me.hand.includes(8) && (me.hand.includes(5) || me.hand.includes(7)))
        throw new GameError("มีกษัตริย์หรือเจ้าชายคู่กับเคาน์เตส ต้องเล่นเคาน์เตส");
      const info = LCARDS[c];
      const others = P.filter((p, j) => j !== i && !p.out && !p.prot);
      const cands = info.target === "any" ? [...others, me] : info.target === "other" ? others : [];
      let t: LPlayer | null = null;
      if (cands.length) {
        t = cands.find((p) => p.id === a.target) ?? null;
        if (!t) throw new GameError("เลือกเป้าหมายก่อน");
      }
      if (c === 1 && t && (a.guess === null || a.guess === 1 || !LCARDS[a.guess])) throw new GameError("ทายไพ่ 1 ใบ (ห้ามทายทหารยาม)");

      me.hand.splice(at, 1);
      me.discards.push(c);
      const ev: Omit<LEvent, "n"> = { actor: me.id, card: c, res: "none" };
      if (t) ev.target = t.id;
      if (info.target !== "none" && !t) ev.res = "protected";

      if (t) {
        switch (c) {
          case 1:
            ev.guess = a.guess!;
            if (t.hand[0] === a.guess) { ev.res = "out"; ev.outId = t.id; ev.outCard = t.hand[0]; eliminate(t); }
            else ev.res = "safe";
            break;
          case 2:
            note(st, me, { kind: "priest", other: t.id, theirs: t.hand[0] });
            ev.res = "look";
            break;
          case 3: {
            const mine = me.hand[0], theirs = t.hand[0];
            note(st, me, { kind: "baron", other: t.id, theirs, mine });
            note(st, t, { kind: "baron", other: me.id, theirs: mine, mine: theirs });
            if (mine > theirs) { ev.res = "out"; ev.outId = t.id; ev.outCard = theirs; eliminate(t); }
            else if (theirs > mine) { ev.res = "out"; ev.outId = me.id; ev.outCard = mine; eliminate(me); }
            else ev.res = "tie";
            break;
          }
          case 5: {
            const d = t.hand.pop()!;
            t.discards.push(d);
            ev.discarded = d;
            if (d === 9) { ev.res = "out"; ev.outId = t.id; ev.outCard = 9; eliminate(t); }
            else {
              if (st.deck.length) t.hand.push(st.deck.pop()!);
              else if (st.aside !== null) { t.hand.push(st.aside); st.aside = null; }
              ev.res = "drew";
            }
            break;
          }
          case 7:
            [me.hand, t.hand] = [t.hand, me.hand];
            ev.res = "swap";
            break;
        }
      } else if (c === 4) {
        me.prot = true;
      } else if (c === 6) {
        const n = Math.min(2, st.deck.length);
        for (let k = 0; k < n; k++) me.hand.push(st.deck.pop()!);
        if (n > 0) { st.chancellor = true; ev.res = "draw2"; }
      } else if (c === 9) {
        ev.res = "self-out";
        ev.outId = me.id;
        ev.outCard = 9;
        eliminate(me);
      }
      pushEvent(st, ev);
      if (!st.chancellor) endTurn(st);
      break;
    }

    case "keep": {
      if (st.phase !== "play" || !st.chancellor || st.current !== i) throw new GameError("ตอนนี้เลือกเก็บไพ่ไม่ได้");
      const at = me.hand.indexOf(a.card);
      if (at < 0) throw new GameError("คุณไม่มีไพ่ใบนี้ในมือ");
      const rest = me.hand.filter((_, k) => k !== at);
      me.hand = [a.card];
      st.deck.unshift(...shuffle(rest)); // สอดไว้ใต้กอง
      st.chancellor = false;
      endTurn(st);
      break;
    }

    case "next":
      if (st.phase !== "round") throw new GameError("รอบนี้ยังไม่จบ");
      newRound(st);
      break;

    case "again":
      hostOnly();
      if (st.phase !== "end") throw new GameError("เกมยังไม่จบ");
      P.forEach((p) => (p.tokens = 0));
      st.round = 0;
      newRound(st);
      break;

    case "reset":
      hostOnly();
      st.phase = "lobby";
      st.round = 0;
      st.events = [];
      st.roundWin = null;
      st.chancellor = false;
      P.forEach((p) => { p.hand = []; p.discards = []; p.out = false; p.prot = false; p.tokens = 0; p.notes = []; });
      break;

    case "kick": {
      hostOnly();
      const j = a.player;
      if (!P[j] || P[j].id === st.hostId) throw new GameError("เลือกผู้เล่นที่จะเชิญออกไม่ถูกต้อง");
      P.splice(j, 1);
      if (st.starter >= P.length) st.starter = 0;
      if (st.phase === "play") {
        if (P.length < LETTER_MIN) { st.phase = "lobby"; P.forEach((p) => { p.hand = []; p.discards = []; p.out = false; }); }
        else { st.round -= 1; newRound(st); } // เริ่มรอบนี้ใหม่ ตรายังอยู่
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

/* ---------- มุมมองสาธารณะ: ไม่มีไพ่ในมือ (ยกเว้นตอนจบรอบ) และไม่มีลำดับกอง ---------- */
export type LPublicPlayer = { id: string; name: string; out: boolean; prot: boolean; tokens: number; discards: number[]; handCount: number };
export type LetterView = {
  game: "letter";
  phase: LPhase;
  hostId: string;
  locked: boolean;
  players: LPublicPlayer[];
  deckCount: number;
  faceUp: number[];
  current: number;
  round: number;
  chancellor: boolean;
  events: LEvent[];
  eventSeq: number;
  roundWin: RoundWin | null;
  need: number;
};
export function letterView(st: LetterState): LetterView {
  return {
    game: "letter",
    phase: st.phase,
    hostId: st.hostId,
    locked: st.locked,
    players: st.players.map((p) => ({ id: p.id, name: p.name, out: p.out, prot: p.prot, tokens: p.tokens, discards: p.discards, handCount: p.hand.length })),
    deckCount: st.deck.length,
    faceUp: st.faceUp,
    current: st.current,
    round: st.round,
    chancellor: st.chancellor,
    events: st.events,
    eventSeq: st.eventSeq,
    roundWin: st.roundWin,
    need: tokensToWin(st.players.length),
  };
}

export type LetterPrivate = { hand: number[]; notes: LNote[] };
export function letterPrivate(st: LetterState, playerId: string): LetterPrivate {
  const me = st.players.find((p) => p.id === playerId);
  return { hand: me?.hand ?? [], notes: me?.notes ?? [] };
}
