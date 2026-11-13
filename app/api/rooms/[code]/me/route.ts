import type { NextRequest } from "next/server";
import { privateAny } from "@/lib/games";
import { cleanCode, getRoom, playerFromToken } from "@/lib/rooms-server";
import { COOKIE, fail, json, rateLimit } from "@/lib/security";

// ข้อมูลลับของ "คุณ" เท่านั้น (ไพ่ในมือ บทบาท ฯลฯ): -> { playerId, priv, version }
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = cleanCode((await params).code);
    const playerId = await playerFromToken(code, req.cookies.get(COOKIE)?.value);
    await rateLimit(`me:${code}:${playerId}`, 240, 60);
    const { state, version } = await getRoom(code);
    if (!(state.players as { id: string }[]).some((p) => p.id === playerId)) return json({ error: "คุณไม่ได้อยู่ในห้องนี้แล้ว" }, 401);
    return json({ playerId, priv: privateAny(state, playerId), version });
  } catch (e) {
    return fail(e);
  }
}
