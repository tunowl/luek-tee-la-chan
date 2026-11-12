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

## ติดตั้ง
### 1. Supabase (ใช้โปรเจกต์ที่มีอยู่แล้วได้)
ตาราง ฟังก์ชัน และงาน cron ของเกมนี้ขึ้นต้นด้วย `lth_` ทั้งหมด จึงอยู่ร่วมกับแอปอื่นในโปรเจกต์เดียวกันได้
และ `schema.sql` แตะเฉพาะของตัวเอง ไม่เปลี่ยนสิทธิ์หรือ Realtime ของตารางอื่น

1. ตรวจว่าโปรเจกต์ยังไม่มีตารางชื่อขึ้นต้นด้วย `lth_` (ถ้ามี ให้เปลี่ยน prefix ใน `lib/db-names.ts` และไฟล์ SQL ให้ตรงกัน)
2. เปิด **Database → Extensions** แล้วเปิด `pg_cron` (ถ้ายังไม่ได้เปิด)
3. ใน **SQL Editor** รัน `supabase/schema.sql` แล้วตามด้วย `supabase/seed.sql`
4. ตรวจ **Database → Publications → supabase_realtime** ว่ามี `lth_room_views` เพิ่มเข้ามา
5. ใช้ค่า URL, Publishable key และ Secret key ของโปรเจกต์เดิม (Project Settings → API Keys)

อยากถอดเกมออกเมื่อไหร่ รัน `supabase/uninstall.sql` จะลบเฉพาะของเกมนี้

**เรื่องควรรู้เมื่อใช้โปรเจกต์ร่วมกัน:** Secret key เข้าถึงได้ทั้งโปรเจกต์ รวมถึงข้อมูลของแอปอื่น
เก็บไว้ใน Vercel แบบ Sensitive เท่านั้น และเกมนี้ใช้โควตา free tier ร่วมกับแอปเดิม

### 2. รันบนเครื่อง (Node 24)
```bash
cp .env.example .env.local     # ใส่ค่าให้ครบ
npm install                    # แล้ว commit package-lock.json ด้วย
npm run audit                  # ต้องไม่มีช่องโหว่ระดับ moderate ขึ้นไป
npm run dev
```

### 3. Vercel
1. push ขึ้น GitHub แล้ว Import ที่ vercel.com
2. ใส่ Environment Variables ตาม `.env.example` (ตั้ง `SUPABASE_SECRET_KEY` และ `CRON_SECRET` เป็น Sensitive)
3. Deploy แล้ว Vercel Cron จะเรียก `/api/cron/cleanup` วันละครั้งเป็นตัวสำรองของ pg_cron

## การล้างห้องอัตโนมัติ
- ห้องที่**ไม่มีความเคลื่อนไหวเกิน 1 วัน** (นับจากการกระทำล่าสุด) จะถูกซ่อนจากทุกคนทันที
  ทั้งใน RLS ของ `lth_room_views`, ใน API และในฟังก์ชัน `lth_commit_room`
- `pg_cron` ลบห้องเหล่านั้นจริงทุก 15 นาที (ข้อมูลผู้เล่นและ token ถูกลบตามด้วย cascade)
- Vercel Cron เรียกซ้ำวันละครั้งเผื่อ pg_cron มีปัญหา

## มาตรการความปลอดภัย
อ้างอิงแนวทาง OWASP Top 10 และ OWASP ASVS สำหรับแอปขนาดนี้

| ความเสี่ยง | สิ่งที่ทำ |
|---|---|
| แอบดูไพ่คนอื่น / กองไพ่ | สถานะเต็มอยู่ในตาราง `lth_rooms` ที่ฝั่งเว็บอ่านไม่ได้ Realtime ส่งเฉพาะ `lth_room_views` ที่ไม่มีไพ่ในมือและลำดับกองไพ่ ไพ่ของตัวเองดึงผ่าน `/api/rooms/[code]/me` ซึ่งตรวจตัวตนก่อน |
| สวมรอยเป็นผู้เล่นอื่น | token สุ่ม 256 บิต เก็บใน cookie `httpOnly` + `Secure` + `SameSite=Strict` จำกัด path เฉพาะห้อง ฐานข้อมูลเก็บแค่ SHA-256 ของ token |
| โกงกติกา | ทุกการกระทำตรวจกติกาฝั่งเซิร์ฟเวอร์ด้วย `lib/engine.ts` ฝั่งเว็บเขียนฐานข้อมูลตรงไม่ได้ |
| CSRF | cookie `SameSite=Strict` และตรวจ header `Origin` / `Sec-Fetch-Site` ทุกคำขอที่เปลี่ยนข้อมูล |
| XSS | React escape ข้อความทั้งหมด ไม่ใช้ `dangerouslySetInnerHTML` มี CSP แบบ nonce ต่อคำขอ (`proxy.ts`) |
| Clickjacking | `frame-ancestors 'none'` และ `X-Frame-Options: DENY` |
| Injection | ใช้ query builder / RPC แบบ parameterized ตรวจรูปแบบ action ทุกช่องแบบ allowlist ชื่อผู้เล่นตัดอักขระควบคุมและอักขระมองไม่เห็น |
| เดารหัสห้อง / สแปม | รหัส 6 ตัวจาก 31 ตัวอักษร (~887 ล้านแบบ) สุ่มแบบไม่เอนเอียง rate limit ใน Postgres: สร้างห้อง 10 ครั้ง/10 นาที/IP, เข้าห้อง 20 ครั้ง/10 นาที/IP, การกระทำ 90 ครั้ง/นาที/ผู้เล่น |
| คนแปลกหน้าเข้าห้อง | เจ้าของห้องปิดรับคนเพิ่ม และเชิญผู้เล่นออกได้ (token ของคนที่ถูกเชิญออกจะถูกลบทันที) |
| เขียนทับกัน (race) | `lth_commit_room` อัปเดตแบบตรวจเวอร์ชันใน transaction เดียว ทั้งสถานะลับ มุมมองสาธารณะ และรายชื่อผู้เล่น |
| สิทธิ์ฐานข้อมูลเกินจำเป็น | RLS เปิดทุกตาราง ถอนสิทธิ์เขียนจาก `anon`/`authenticated` ฟังก์ชันทั้งหมด `security definer` + `search_path` ตายตัว และเรียกได้เฉพาะ `service_role` |
| ความลับรั่ว | service role key ใช้เฉพาะไฟล์ที่ import `server-only` error ที่ตอบกลับไม่มีรายละเอียดภายใน |
| DoS ด้วย body ใหญ่ | จำกัด body 2 KB และรับเฉพาะ `application/json` |
| Security headers | HSTS (preload), CSP, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP, ปิด `X-Powered-By`, API ตอบ `Cache-Control: no-store` |
| ช่องโหว่ใน dependency | ล็อกเวอร์ชันแบบ exact (Next.js 16.4.5 ซึ่งแก้ advisory ล่าสุดเดือน พ.ย. 2026), Dependabot ตรวจทุกสัปดาห์, `npm run audit` |
| เก็บข้อมูลเกินจำเป็น | ไม่มีบัญชี ไม่เก็บอีเมล เก็บแค่ชื่อเล่นที่พิมพ์เอง และลบทั้งห้องหลังไม่ขยับ 1 วัน |

### ข้อที่ยังต้องรู้
- **Presence:** ช่อง Realtime ของห้องเปิดด้วย anon key ใครรู้รหัสห้องจะเห็นว่าใครออนไลน์ (เห็นแค่ id ผู้เล่น ไม่เห็นไพ่ และส่งการกระทำไม่ได้)
  ถ้าต้องการปิด ให้เปิด Realtime Authorization แบบ private channel ใน Supabase
- **การ์ดที่ถูกเปิดถามแล้ว** และการ์ดที่วางตรงหน้าเป็นข้อมูลสาธารณะในห้องตามกติกา
- ทำ penetration test หรือให้คนตรวจโค้ดอีกรอบก่อนเปิดให้คนทั่วไปใช้ในวงกว้าง

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
