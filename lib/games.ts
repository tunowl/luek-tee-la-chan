// รวมทุกเกมในเว็บ: สร้างห้อง เพิ่มผู้เล่น ส่งการกระทำ และแยกข้อมูลสาธารณะ/ลับ ตามชนิดเกม
import { addPlayer as addLth, applyAction as applyLth, createState as createLth, GameError, MAX_PLAYERS as LTH_MAX, toView as lthView, type Action as LthAction, type Card, type GameState, type GameView, type Pools } from "./engine";
import { addWolfPlayer, applyWolf, createWolf, WOLF_MAX, WOLF_MIN, wolfPrivate, wolfView, type WolfAction, type WolfPrivate, type WolfState, type WolfView } from "./wolf";
import { addSpyPlayer, applySpy, createSpy, SPY_MAX, SPY_MIN, spyPrivate, spyView, type SpyAction, type SpyPrivate, type SpyState, type SpyView } from "./spy";
import { addLetterPlayer, applyLetter, createLetter, LETTER_MAX, LETTER_MIN, letterPrivate, letterView, type LetterAction, type LetterPrivate, type LetterState, type LetterView } from "./letter";

export type GameKind = "lth" | "wolf" | "letter" | "spy";
export const GAME_KINDS: GameKind[] = ["lth", "wolf", "letter", "spy"];

export const GAMES: Record<GameKind, { name: string; short: string; desc: string; min: number; max: number; players: string }> = {
  lth: { name: "ลึกทีละชั้น", short: "การ์ดชวนคุย", desc: "การ์ดคำถาม 147 ใบ สามระดับ ค่อย ๆ คุยลึกขึ้นทีละชั้น", min: 2, max: LTH_MAX, players: "2–6 คน" },
  wolf: { name: "มนุษย์หมาป่า", short: "เกมจับผิด", desc: "หมาป่าแฝงตัวในหมู่บ้าน กลางคืนล่า กลางวันโหวตหาตัว เจ้าของห้องเป็นผู้ดำเนินเกม", min: WOLF_MIN + 1, max: WOLF_MAX, players: `${WOLF_MIN}–${WOLF_MAX - 1} คน + ผู้ดำเนินเกม` },
  spy: { name: "สายลับในวง", short: "เกมจับโกหก", desc: "ทุกคนรู้ว่าอยู่ที่ไหน ยกเว้นสายลับ ถามตอบกันให้จับได้ก่อนเขาเดาสถานที่ออก", min: SPY_MIN, max: SPY_MAX, players: `${SPY_MIN}–${SPY_MAX} คน` },
  letter: { name: "จดหมายลับ", short: "เกมไพ่", desc: "ส่งจดหมายถึงเจ้าหญิงให้ถึงมือ ไพ่ 21 ใบ ถือทีละใบ เดา หลบ และหักหลัง", min: LETTER_MIN, max: LETTER_MAX, players: "2–6 คน" },
};

export type AnyState = GameState | WolfState | LetterState | SpyState;
export type AnyView = GameView | WolfView | LetterView | SpyView;
export type AnyAction = LthAction | WolfAction | LetterAction | SpyAction;
export type AnyPrivate =
  | { game: "lth"; hand: Card[] }
  | ({ game: "wolf" } & { me: WolfPrivate })
  | ({ game: "letter" } & LetterPrivate)
  | { game: "spy"; me: SpyPrivate };

export const gameOf = (s: { game?: GameKind }): GameKind => s.game ?? "lth";
export const isGameKind = (v: unknown): v is GameKind => typeof v === "string" && (GAME_KINDS as string[]).includes(v);

export function createAny(kind: GameKind, hostId: string, hostName: string): AnyState {
  if (kind === "wolf") return createWolf(hostId, hostName);
  if (kind === "letter") return createLetter(hostId, hostName);
  if (kind === "spy") return createSpy(hostId, hostName);
  return createLth(hostId, hostName);
}

export function addAny(st: AnyState, id: string, name: string, pools: () => Pools): AnyState {
  switch (gameOf(st)) {
    case "wolf": return addWolfPlayer(st as WolfState, id, name);
    case "letter": return addLetterPlayer(st as LetterState, id, name);
    case "spy": return addSpyPlayer(st as SpyState, id, name);
    default: return addLth(st as GameState, id, name, pools());
  }
}

// การกระทำที่ไม่ใช่ของเกมนั้น ตัว engine ของเกมจะปฏิเสธเองใน default case
export function applyAny(st: AnyState, playerId: string, a: AnyAction, pools: () => Pools): AnyState {
  switch (gameOf(st)) {
    case "wolf": return applyWolf(st as WolfState, playerId, a as WolfAction);
    case "letter": return applyLetter(st as LetterState, playerId, a as LetterAction);
    case "spy": return applySpy(st as SpyState, playerId, a as SpyAction);
    default: return applyLth(st as GameState, playerId, a as LthAction, pools());
  }
}

export function viewAny(st: AnyState): AnyView {
  switch (gameOf(st)) {
    case "wolf": return wolfView(st as WolfState);
    case "letter": return letterView(st as LetterState);
    case "spy": return spyView(st as SpyState);
    default: return lthView(st as GameState);
  }
}

export function privateAny(st: AnyState, playerId: string): AnyPrivate {
  switch (gameOf(st)) {
    case "wolf": return { game: "wolf", me: wolfPrivate(st as WolfState, playerId) };
    case "letter": return { game: "letter", ...letterPrivate(st as LetterState, playerId) };
    case "spy": return { game: "spy", me: spyPrivate(st as SpyState, playerId) };
    default: {
      const me = (st as GameState).players.find((p) => p.id === playerId);
      if (!me) throw new GameError("UNAUTHORIZED");
      return { game: "lth", hand: me.hand };
    }
  }
}

export const needsPools = (st: AnyState) => gameOf(st) === "lth";
