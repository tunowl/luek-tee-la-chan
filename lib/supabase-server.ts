import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

<<<<<<< HEAD
// ใช้ Secret key ฝั่งเซิร์ฟเวอร์เท่านั้น (รองรับชื่อเก่า SUPABASE_SERVICE_ROLE_KEY ด้วย)
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
=======
// ใช้ service role ฝั่งเซิร์ฟเวอร์เท่านั้น
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY");
  admin = createClient(url, key, { auth: { persistSession: false } });
>>>>>>> 6566f9f5d0a050274e3bba620f5895c0de90cb2b
  return admin;
}
