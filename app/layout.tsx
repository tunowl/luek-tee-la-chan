import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Anuphan, Mitr } from "next/font/google";
import "./globals.css";

const display = Mitr({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-display", display: "swap" });
const body = Anuphan({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "ลึกทีละชั้น — การ์ดชวนคุยออนไลน์",
  description: "การ์ดชวนคุย 147 ใบ สามระดับ เล่นด้วยกันจากโทรศัพท์ของแต่ละคน",
  referrer: "strict-origin-when-cross-origin",
  robots: { index: true, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // ให้หน้าเรนเดอร์แบบ dynamic เพื่อให้ nonce ของ CSP ใช้ได้
  return (
    <html lang="th" className={`${display.variable} ${body.variable}`}>
      <body data-level="1">{children}</body>
    </html>
  );
}
