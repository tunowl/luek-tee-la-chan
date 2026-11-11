import type { NextRequest } from "next/server";
import { cleanCode, getRoom, playerFromToken } from "@/lib/rooms-server";
import { COOKIE, fail, json, rateLimit } from "@/lib/security";

// ไพ่ในมือของ "คุณ" เท่านั้น: -> { playerId, hand, version }
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const playerId = await playerFromToken(code, req.cookies.get(COOKIE)?.value);
    await rateLimit(`me:${code}:${playerId}`, 240, 60);
    const { state, version } = await getRoom(code);
    const me = state.players.find((p) => p.id === playerId);
    if (!me) return json({ error: "คุณไม่ได้อยู่ในห้องนี้แล้ว" }, 401);
    return json({ playerId, hand: me.hand, version });
  } catch (e) {
    return fail(e);
  }
}
