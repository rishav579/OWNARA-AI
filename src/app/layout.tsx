import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BIHARI AI — Engineering Documentation",
  description:
    "BIHARI AI engineering documentation hub. India's Trusted AI Employee Company. Locked, versioned, audit-first engineering specs for Version 1.",
  keywords: [
    "BIHARI AI",
    "AI Employee",
    "Engineering Documentation",
    "Audit-First",
    "Trust Architecture",
  ],
  authors: [{ name: "BIHARI AI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "BIHARI AI — Engineering Documentation",
    description:
      "India's Trusted AI Employee Company. Locked, versioned, audit-first engineering specs.",
    siteName: "BIHARI AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
