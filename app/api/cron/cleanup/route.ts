import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { FN } from "@/lib/db-names";
import { fail, json, safeEqual } from "@/lib/security";

// สำรองให้ pg_cron: Vercel Cron เรียกวันละครั้งพร้อม Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") || "";
    if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: "unauthorized" }, 401);
    const { data, error } = await supabaseAdmin().rpc(FN.cleanup);
    if (error) throw error;
    return json({ deleted: data });
  } catch (e) {
    return fail(e);
  }
}
