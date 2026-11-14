# ที่มาของ skill ในโฟลเดอร์นี้

Claude Code อ่าน skill จาก `.claude/skills/` ของโปรเจกต์นี้อัตโนมัติ (ไม่กระทบตัวเว็บหรือการ build)
แต่ละโฟลเดอร์มีไฟล์ LICENSE ของต้นฉบับแนบไว้

| ที่มา | commit | สัญญาอนุญาต | skill |
|---|---|---|---|
| https://github.com/emilkowalski/skills | 0f2e23b | MIT | animate, animate-expo, animation-performance, animation-vocabulary, apple-design, ask-sonner, break-ui, choreograph, emil-design-eng, find-animation-opportunities, gestures, improve-animations, learn-taste, mobile-native, pick-ui-library, prototype, remove-animations, review-animations, write-swift |
| https://github.com/pbakaus/impeccable | 1995764 | Apache 2.0 | impeccable |
| https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | 6ae86f6 | MIT | ui-ux-pro-max, design-system, ui-styling, design, brand, banner-design, slides |

หมายเหตุ
- impeccable: สคริปต์ `scripts/impeccable` จะดาวน์โหลดตัวโปรแกรมจาก GitHub releases ของโปรเจกต์ แล้วตรวจกับ `engine-checksums.txt` ก่อนรัน
  hook ตรวจดีไซน์อัตโนมัติจะเปิดก็ต่อเมื่อสั่ง `/impeccable hooks on` เท่านั้น
- ui-ux-pro-max: ตัดโฟลเดอร์ `scripts/tests` (ชุดทดสอบของผู้พัฒนา) ออก
- อัปเดตเป็นเวอร์ชันใหม่: clone repo ต้นฉบับแล้วคัดลอกโฟลเดอร์ skill มาทับ
