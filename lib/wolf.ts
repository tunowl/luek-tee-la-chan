// มนุษย์หมาป่า แบบมีผู้ดำเนินเกม (เจ้าของห้อง) ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// เจ้าของห้องไม่ได้รับบทบาท เห็นบทบาททุกคน และกดบันทึกสิ่งที่เกิดขึ้นตอนกลางคืน
import { GameError } from "./engine";

export type WolfRole = "wolf" | "seer" | "doctor" | "hunter" | "villager";
export type WolfPhase = "lobby" | "night" | "day" | "end";
export type Team = "wolf" | "village";

export const WOLF_MIN = 5; // ผู้เล่นขั้นต่ำ ไม่รวมผู้ดำเนินเกม
export const WOLF_MAX = 16; // รวมผู้ดำเนินเกม

export const ROLES: Record<WolfRole, { name: string; team: Team; how: string }> = {
  wolf: { name: "มนุษย์หมาป่า", team: "wolf", how: "ตอนกลางคืน ลืมตาพร้อมหมาป่าตัวอื่นแล้วชี้เหยื่อ 1 คน ตอนกลางวันทำตัวเป็นชาวบ้าน" },
  seer: { name: "ผู้หยั่งรู้", team: "village", how: "ตอนกลางคืน ชี้ผู้เล่น 1 คน ผู้ดำเนินเกมจะส่งสัญญาณว่าเป็นหมาป่าหรือไม่" },
  doctor: { name: "หมอ", team: "village", how: "ตอนกลางคืน ชี้ผู้เล่น 1 คน (ชี้ตัวเองได้) ถ้าหมาป่าเลือกคนนั้น เขาจะรอด" },
  hunter: { name: "นายพราน", team: "village", how: "ถ้าคุณตาย ไม่ว่าทางไหน ชี้ยิงผู้เล่นอีก 1 คนให้ตายตามไปได้ทันที" },
  villager: { name: "ชาวบ้าน", team: "village", how: "ไม่มีพลังพิเศษ ช่วยกันจับผิดแล้วโหวตหมาป่าออกตอนกลางวัน" },
};
export const ROLE_ORDER: WolfRole[] = ["wolf", "seer", "doctor", "hunter", "villager"];

export type WolfSettings = { auto: boolean; wolves: number; seer: boolean; doctor: boolean; hunter: boolean };
export type WolfPlayer = { id: string; name: string; role: WolfRole | null; alive: boolean };
export type Night = { kill: string | null; save: string | null; check: string | null };
export type WolfEvent =
  | { n: number; day: number; type: "night"; died: string[] }
  | { n: number; day: number; type: "vote"; died: string | null }
  | { n: number; day: number; type: "mark"; id: string; alive: boolean };

export type WolfState = {
  game: "wolf";
  phase: WolfPhase;
  hostId: string;
  locked: boolean;
  players: WolfPlayer[];
  settings: WolfSettings;
  roster: Record<WolfRole, number>;
  day: number;
  night: Night;
  votes: Record<string, string>;
  events: WolfEvent[];
  eventSeq: number;
  winner: Team | null;
};

export type WolfAction =
  | { type: "start" }
  | { type: "settings"; auto: boolean; wolves: number; seer: boolean; doctor: boolean; hunter: boolean }
  | { type: "night"; step: "kill" | "save" | "check"; target: string | null }
  | { type: "dawn" }
  | { type: "vote"; target: string | null }
  | { type: "execute"; target: string | null }
  | { type: "mark"; target: string; alive: boolean }
  | { type: "reset" }
  | { type: "kick"; player: number }
  | { type: "lock"; locked: boolean };

const emptyNight = (): Night => ({ kill: null, save: null, check: null });
const emptyRoster = (): Record<WolfRole, number> => ({ wolf: 0, seer: 0, doctor: 0, hunter: 0, villager: 0 });

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** จำนวนบทบาทที่จะแจก สำหรับผู้เล่น n คน (ไม่รวมผู้ดำเนินเกม) */
export function rosterFor(n: number, s: WolfSettings): Record<WolfRole, number> {
  const r = emptyRoster();
  if (s.auto) {
    r.wolf = n <= 6 ? 1 : n <= 10 ? 2 : n <= 14 ? 3 : 4;
    r.seer = 1;
    r.doctor = 1;
    r.hunter = n >= 7 ? 1 : 0;
  } else {
    r.wolf = s.wolves;
    r.seer = s.seer ? 1 : 0;
    r.doctor = s.doctor ? 1 : 0;
    r.hunter = s.hunter ? 1 : 0;
  }
  r.villager = Math.max(0, n - r.wolf - r.seer - r.doctor - r.hunter);
  return r;
}
export function rosterProblem(n: number, r: Record<WolfRole, number>): string | null {
  if (n < WOLF_MIN) return `ต้องมีผู้เล่นอย่างน้อย ${WOLF_MIN} คน ไม่รวมผู้ดำเนินเกม`;
  if (r.wolf < 1) return "ต้องมีหมาป่าอย่างน้อย 1 ตัว";
  if (r.wolf * 2 >= n) return "หมาป่าต้องน้อยกว่าครึ่งวง";
  if (r.wolf + r.seer + r.doctor + r.hunter > n) return "บทบาทพิเศษมากกว่าจำนวนผู้เล่น";
  return null;
}

const actors = (st: WolfState) => st.players.filter((p) => p.id !== st.hostId);
const inGame = (st: WolfState) => actors(st).filter((p) => p.role !== null);
function find(st: WolfState, id: string | null, mustBeAlive = true): WolfPlayer | null {
  if (id === null) return null;
  const p = inGame(st).find((x) => x.id === id);
  if (!p || (mustBeAlive && !p.alive)) throw new GameError("เลือกผู้เล่นที่ยังอยู่ในเกม");
  return p;
}
function pushEvent(st: WolfState, e: Record<string, unknown>) {
  st.eventSeq += 1;
  st.events = [...st.events, { ...e, n: st.eventSeq, day: st.day } as WolfEvent].slice(-30);
}
function checkWin(st: WolfState) {
  const alive = inGame(st).filter((p) => p.alive);
  const wolves = alive.filter((p) => p.role === "wolf").length;
  if (wolves === 0) st.winner = "village";
  else if (wolves >= alive.length - wolves) st.winner = "wolf";
  if (st.winner) {
    st.phase = "end";
    st.night = emptyNight();
    st.votes = {};
  }
}
function dropVotesFor(st: WolfState, id: string) {
  delete st.votes[id];
  for (const [k, v] of Object.entries(st.votes)) if (v === id) delete st.votes[k];
}

export function createWolf(hostId: string, hostName: string): WolfState {
  return {
    game: "wolf",
    phase: "lobby",
    hostId,
    locked: false,
    players: [{ id: hostId, name: hostName, role: null, alive: false }],
    settings: { auto: true, wolves: 1, seer: true, doctor: true, hunter: false },
    roster: emptyRoster(),
    day: 0,
    night: emptyNight(),
    votes: {},
    events: [],
    eventSeq: 0,
    winner: null,
  };
}

export function addWolfPlayer(prev: WolfState, id: string, name: string): WolfState {
  const st = structuredClone(prev);
  const ex = st.players.find((p) => p.id === id);
  if (ex) {
    if (st.phase === "lobby") ex.name = name;
    return st;
  }
  if (st.locked) throw new GameError("เจ้าของห้องปิดรับคนเพิ่มแล้ว");
  if (st.players.length >= WOLF_MAX) throw new GameError(`ห้องนี้เต็มแล้ว (${WOLF_MAX} คน)`);
  // เข้ามากลางเกม = ดูอยู่ข้างสนาม ได้บทบาทในเกมถัดไป
  st.players.push({ id, name, role: null, alive: false });
  return st;
}

export function applyWolf(prev: WolfState, playerId: string, a: WolfAction): WolfState {
  const st = structuredClone(prev);
  const i = st.players.findIndex((p) => p.id === playerId);
  if (i < 0) throw new GameError("คุณยังไม่ได้อยู่ในห้องนี้");
  const me = st.players[i];
  const isHost = playerId === st.hostId;
  const hostOnly = () => { if (!isHost) throw new GameError("เฉพาะผู้ดำเนินเกม"); };

  switch (a.type) {
    case "settings": {
      hostOnly();
      if (st.phase !== "lobby") throw new GameError("ตั้งค่าได้เฉพาะก่อนเริ่มเกม");
      st.settings = { auto: !!a.auto, wolves: Math.min(5, Math.max(1, a.wolves)), seer: !!a.seer, doctor: !!a.doctor, hunter: !!a.hunter };
      break;
    }
    case "start": {
      hostOnly();
      if (st.phase !== "lobby") throw new GameError("เกมเริ่มไปแล้ว");
      const ps = actors(st);
      const r = rosterFor(ps.length, st.settings);
      const bad = rosterProblem(ps.length, r);
      if (bad) throw new GameError(bad);
      const bag: WolfRole[] = [];
      ROLE_ORDER.forEach((role) => { for (let k = 0; k < r[role]; k++) bag.push(role); });
      const dealt = shuffle(bag);
      ps.forEach((p, k) => { p.role = dealt[k]; p.alive = true; });
      st.roster = r;
      st.day = 1;
      st.night = emptyNight();
      st.votes = {};
      st.events = [];
      st.winner = null;
      st.phase = "night";
      break;
    }
    case "night": {
      hostOnly();
      if (st.phase !== "night") throw new GameError("ตอนนี้ไม่ใช่กลางคืน");
      find(st, a.target);
      st.night = { ...st.night, [a.step]: a.target };
      break;
    }
    case "dawn": {
      hostOnly();
      if (st.phase !== "night") throw new GameError("ตอนนี้ไม่ใช่กลางคืน");
      const { kill, save } = st.night;
      const died: string[] = [];
      if (kill && kill !== save) {
        const v = find(st, kill, false);
        if (v && v.alive) { v.alive = false; died.push(v.id); }
      }
      pushEvent(st, { type: "night", died });
      st.night = emptyNight();
      st.votes = {};
      st.phase = "day";
      checkWin(st);
      break;
    }
    case "vote": {
      if (st.phase !== "day") throw new GameError("โหวตได้เฉพาะตอนกลางวัน");
      if (isHost || !me.role || !me.alive) throw new GameError("เฉพาะผู้เล่นที่ยังมีชีวิตที่โหวตได้");
      if (a.target === null) { delete st.votes[me.id]; break; }
      if (a.target === me.id) throw new GameError("โหวตตัวเองไม่ได้");
      find(st, a.target);
      st.votes[me.id] = a.target;
      break;
    }
    case "execute": {
      hostOnly();
      if (st.phase !== "day") throw new GameError("ตอนนี้ไม่ใช่กลางวัน");
      const t = find(st, a.target);
      if (t) t.alive = false;
      pushEvent(st, { type: "vote", died: t ? t.id : null });
      st.votes = {};
      st.day += 1;
      st.phase = "night";
      checkWin(st);
      break;
    }
    case "mark": {
      hostOnly();
      if (st.phase !== "night" && st.phase !== "day") throw new GameError("ตอนนี้แก้สถานะไม่ได้");
      const t = find(st, a.target, false)!;
      if (t.alive === a.alive) break;
      t.alive = a.alive;
      if (!a.alive) dropVotesFor(st, t.id);
      pushEvent(st, { type: "mark", id: t.id, alive: a.alive });
      checkWin(st);
      break;
    }
    case "reset": {
      hostOnly();
      st.players.forEach((p) => { p.role = null; p.alive = false; });
      st.phase = "lobby";
      st.day = 0;
      st.night = emptyNight();
      st.votes = {};
      st.events = [];
      st.winner = null;
      st.roster = emptyRoster();
      break;
    }
    case "kick": {
      hostOnly();
      const t = st.players[a.player];
      if (!t || t.id === st.hostId) throw new GameError("เลือกผู้เล่นที่จะเชิญออกไม่ถูกต้อง");
      st.players.splice(a.player, 1);
      dropVotesFor(st, t.id);
      for (const k of ["kill", "save", "check"] as const) if (st.night[k] === t.id) st.night[k] = null;
      if (t.role && (st.phase === "night" || st.phase === "day")) checkWin(st);
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

/* ---------- มุมมองสาธารณะ: ไม่มีบทบาท (ยกเว้นตอนจบเกม) ---------- */
export type WolfPublicPlayer = { id: string; name: string; alive: boolean; playing: boolean; role: WolfRole | null };
export type WolfView = {
  game: "wolf";
  phase: WolfPhase;
  hostId: string;
  locked: boolean;
  players: WolfPublicPlayer[];
  settings: WolfSettings;
  roster: Record<WolfRole, number>;
  day: number;
  votes: Record<string, string>;
  events: WolfEvent[];
  eventSeq: number;
  winner: Team | null;
};
export function wolfView(st: WolfState): WolfView {
  return {
    game: "wolf",
    phase: st.phase,
    hostId: st.hostId,
    locked: st.locked,
    players: st.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive, playing: p.role !== null, role: st.phase === "end" ? p.role : null })),
    settings: st.settings,
    roster: st.roster,
    day: st.day,
    votes: st.votes,
    events: st.events,
    eventSeq: st.eventSeq,
    winner: st.winner,
  };
}

/* ---------- ข้อมูลลับเฉพาะคน ---------- */
export type WolfPrivate =
  | { kind: "mod"; roles: Record<string, WolfRole>; night: Night; checkIsWolf: boolean | null }
  | { kind: "player"; role: WolfRole; pack: string[] }
  | { kind: "none" };
export function wolfPrivate(st: WolfState, playerId: string): WolfPrivate {
  if (playerId === st.hostId) {
    const roles: Record<string, WolfRole> = {};
    st.players.forEach((p) => { if (p.role) roles[p.id] = p.role; });
    const c = st.night.check ? st.players.find((p) => p.id === st.night.check) : null;
    return { kind: "mod", roles, night: st.night, checkIsWolf: c ? c.role === "wolf" : null };
  }
  const me = st.players.find((p) => p.id === playerId);
  if (!me || !me.role) return { kind: "none" };
  const pack = me.role === "wolf" ? st.players.filter((p) => p.role === "wolf" && p.id !== me.id).map((p) => p.id) : [];
  return { kind: "player", role: me.role, pack };
}
