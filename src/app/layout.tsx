import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { NextAuthProvider } from "@/components/Providers/NextAuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Modern Kum-Kom | เกมต่ออักษรไทย",
  description: "โปรเจกต์วิชา Software Development - ระบบเกมคำคมยุคใหม่พร้อมคลังคำศัพท์ออนไลน์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* 💡 เพิ่ม className เพื่อให้ Font ทำงานได้ครับ */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextAuthProvider>
            {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}