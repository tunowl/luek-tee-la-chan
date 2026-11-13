"use client";
import type { ReactNode } from "react";
import type { AnyAction } from "@/lib/games";

// สิ่งที่หน้าห้องส่งให้หน้าจอของแต่ละเกม
export type Ctx = {
  code: string;
  myId: string;
  myI: number;
  isHost: boolean;
  busy: boolean;
  online: Set<string>;
  send: (a: AnyAction) => Promise<void>;
  bar: (label: ReactNode) => ReactNode;
  errNote: ReactNode;
};

export const cssVar = (k: string, v: string) => ({ [k]: v }) as React.CSSProperties;

export function Dot({ on }: { on: boolean }) {
  return <span className={`dot ${on ? "" : "off"}`} />;
}
