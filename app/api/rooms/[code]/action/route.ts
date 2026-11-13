import type { NextRequest } from "next/server";
import { applyAny, privateAny, viewAny } from "@/lib/games";
import { cleanCode, loadPools, mutateRoom, playerFromToken } from "@/lib/rooms-server";
import { COOKIE, assertSameOrigin, fail, json, parseAction, rateLimit, readJson } from "@/lib/security";

// ส่งการกระทำในเกม: { action } -> { version, view, priv }
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(req);
    const code = cleanCode((await params).code);
    const playerId = await playerFromToken(code, req.cookies.get(COOKIE)?.value);
    await rateLimit(`act:${code}:${playerId}`, 90, 60);
    const action = parseAction((await readJson(req)).action);
    const pools = await loadPools();
    const { state, version } = await mutateRoom(code, (s) => applyAny(s, playerId, action, () => pools));
    // ส่งผลกลับทันที หน้าเว็บของคนกดไม่ต้องรอ Realtime หรือดึงซ้ำ
    return json({ version, view: viewAny(state), priv: privateAny(state, playerId) });
  } catch (e) {
    return fail(e);
  }
}
