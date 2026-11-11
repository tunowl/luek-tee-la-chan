import type { NextRequest } from "next/server";
import { cleanCode } from "@/lib/rooms-server";
import { assertSameOrigin, clearTokenCookie, fail, json } from "@/lib/security";

// ลบ cookie ของห้องนี้ออกจากเบราว์เซอร์
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(req);
    const code = cleanCode((await params).code);
    const res = json({ ok: true });
    clearTokenCookie(res, code);
    return res;
  } catch (e) {
    return fail(e);
  }
}
