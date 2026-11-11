import type { NextRequest } from "next/server";
import { applyAction } from "@/lib/engine";
import { cleanCode, loadPools, mutateRoom, playerFromToken } from "@/lib/rooms-server";
import { COOKIE, assertSameOrigin, fail, json, parseAction, rateLimit, readJson } from "@/lib/security";

// ส่งการกระทำในเกม: { action } -> { version }
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(req);
    const code = cleanCode((await params).code);
    const playerId = await playerFromToken(code, req.cookies.get(COOKIE)?.value);
    await rateLimit(`act:${code}:${playerId}`, 90, 60);
    const action = parseAction((await readJson(req)).action);
    const pools = await loadPools();
    const { version } = await mutateRoom(code, (s) => applyAction(s, playerId, action, pools));
    return json({ version });
  } catch (e) {
    return fail(e);
  }
}
