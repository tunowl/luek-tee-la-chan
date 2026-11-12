import type { NextRequest } from "next/server";
import { addPlayer } from "@/lib/engine";
import { cleanCode, cleanName, hashToken, loadPools, mutateRoom, newId, newToken } from "@/lib/rooms-server";
import { assertSameOrigin, clientIp, fail, json, rateLimit, readJson, setTokenCookie } from "@/lib/security";

// เข้าห้อง: { name } -> { playerId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    await rateLimit(`join:${ip}`, 20, 600); // กันการสุ่มเดารหัสห้อง
    const code = cleanCode((await params).code);
    const body = await readJson(req);
    const name = cleanName(body.name);
    const pools = await loadPools();
    const playerId = newId();
    const token = newToken();
    await mutateRoom(code, (s) => addPlayer(s, playerId, name, pools), { addPlayer: { id: playerId, tokenHash: hashToken(token) } });
    const res = json({ playerId });
    setTokenCookie(res, code, token);
    return res;
  } catch (e) {
    return fail(e);
  }
}
