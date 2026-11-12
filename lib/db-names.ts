// ชื่อตารางและฟังก์ชันทั้งหมดในฐานข้อมูล ขึ้นต้นด้วย lth_ เพื่อไม่ชนกับแอปอื่นในโปรเจกต์ Supabase เดียวกัน
// ถ้าเปลี่ยน prefix ต้องแก้ใน supabase/schema.sql และ seed.sql ให้ตรงกันด้วย
export const T = {
  questions: "lth_questions",
  rooms: "lth_rooms",
  roomViews: "lth_room_views",
  roomPlayers: "lth_room_players",
  rateLimits: "lth_rate_limits",
} as const;

export const FN = {
  createRoom: "lth_create_room",
  commitRoom: "lth_commit_room",
  rateLimitHit: "lth_rate_limit_hit",
  cleanup: "lth_cleanup_stale_rooms",
} as const;
