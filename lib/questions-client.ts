"use client";
import { supabaseBrowser } from "./supabase-browser";
import { T } from "./db-names";

let cache: Promise<Map<number, string>> | null = null;

// ข้อความคำถามโหลดครั้งเดียวต่อการเปิดหน้า
export function loadQuestionTexts(): Promise<Map<number, string>> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await supabaseBrowser().from(T.questions).select("id, text");
      if (error) throw error;
      return new Map((data as { id: number; text: string }[]).map((r) => [r.id, r.text]));
    })();
    cache.catch(() => (cache = null));
  }
  return cache;
}
