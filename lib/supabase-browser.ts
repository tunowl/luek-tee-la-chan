"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

<<<<<<< HEAD
// Publishable key ใช้ในเบราว์เซอร์ได้ (รองรับชื่อเก่า NEXT_PUBLIC_SUPABASE_ANON_KEY ด้วย)
// ต้องอ้างชื่อตัวแปรตรง ๆ แบบนี้ Next.js ถึงจะฝังค่าตอน build ได้
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;
  if (!URL || !KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  client = createClient(URL, KEY, { auth: { persistSession: false } });
=======
export function supabaseBrowser(): SupabaseClient {
  if (client) return client;
  client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
>>>>>>> 6566f9f5d0a050274e3bba620f5895c0de90cb2b
  return client;
}
