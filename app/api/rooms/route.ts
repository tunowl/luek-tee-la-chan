import type { NextRequest } from "next/server";
import { createState } from "@/lib/engine";
import { cleanName, createRoom, hashToken, newId, newRoomCode, newToken } from "@/lib/rooms-server";
import { assertSameOrigin, clientIp, fail, json, rateLimit, readJson, setTokenCookie } from "@/lib/security";

// สร้างห้องใหม่: { name } -> { code, playerId }  (token ส่งกลับเป็น cookie httpOnly)
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await rateLimit(`create:${clientIp(req)}`, 10, 600);
    const body = await readJson(req);
    const name = cleanName(body.name);
    const playerId = newId();
    const token = newToken();
    for (let i = 0; i < 5; i++) {
      const code = newRoomCode();
      if (await createRoom(code, createState(playerId, name), playerId, hashToken(token))) {
        const res = json({ code, playerId });
        setTokenCookie(res, code, token);
        return res;
      }
    }
    throw new Error("could not allocate room code");
  } catch (e) {
    return fail(e);
  }
}
