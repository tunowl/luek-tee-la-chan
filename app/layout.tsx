import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans_Thai, Mitr } from "next/font/google";
import "./globals.css";

const display = Mitr({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-display", display: "swap" });
// เนื้อหา: IBM Plex Sans Thai (อ่านง่าย ดูเรียบหรู) หัวข้อลึกทีละชั้น: Mitr
const body = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "ลึกทีละชั้น — เกมเล่นกับเพื่อนออนไลน์",
  description: "การ์ดชวนคุย มนุษย์หมาป่า และเกมไพ่จดหมายลับ เล่นด้วยกันจากโทรศัพท์ของแต่ละคน",
  referrer: "strict-origin-when-cross-origin",
  robots: { index: true, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // ให้หน้าเรนเดอร์แบบ dynamic เพื่อให้ nonce ของ CSP ใช้ได้
  return (
    <html lang="th" className={`${display.variable} ${body.variable}`}>
      <body data-level="1" data-theme="home">{children}</body>
    </html>
  );
}
