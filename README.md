# ลึกทีละชั้น — การ์ดชวนคุยออนไลน์

การ์ดชวนคุย 3 ระดับ (ผิวน้ำ · กลางน้ำ · ก้นทะเล) คำถาม 147 ข้อ เล่น 2–6 คนจากโทรศัพท์ของแต่ละคน
**Next.js 16 (App Router)** + **Supabase** (Postgres, Realtime) + **Vercel**

## กติกา
1. ทุกคนได้การ์ดคำถาม 5 ใบ และการ์ดผ่าน 1 ใบ (ได้คืนทุกครั้งที่ขึ้นชั้นใหม่)
2. ถึงตาใคร เลือกการ์ดคำถามหนึ่งใบแล้วเลือกคนที่จะถาม
3. คนถูกถามตอบ หรือใช้การ์ดผ่าน การ์ดที่ตอบแล้วไปวางตรงหน้าคนตอบ
4. การ์ดทุกใบมีเชือก 1 ใน 6 สี ใครได้การ์ดที่มี**สีที่วงยังไม่มีในชั้นนี้** ได้การ์ดพิเศษเพิ่ม 1 ใบ
5. ขึ้นชั้นถัดไปเมื่อ**เชือกครบ 6 สี** หรือ**ทุกคนมีการ์ดตรงหน้าครบ 3 ใบ**
6. จบชั้นก้นทะเลเท่ากับจบรอบ



## โครงสร้าง
```
proxy.ts                        CSP nonce ต่อคำขอ
app/page.tsx                    หน้าแรก
app/room/[code]/Game.tsx        หน้าเล่น
app/api/rooms/...               create, join, action, me, leave
app/api/cron/cleanup/route.ts   ตัวสำรองล้างห้อง
lib/engine.ts                   กติกา + toView() มุมมองสาธารณะ
lib/rooms-server.ts             อ่าน/เขียนห้องผ่าน RPC
lib/db-names.ts                 ชื่อตาราง/ฟังก์ชัน (prefix lth_)
lib/security.ts                 origin check, rate limit, cookie, validation
supabase/schema.sql, seed.sql, uninstall.sql
```
