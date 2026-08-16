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
  title: "OWNARA — India's Trusted AI Employee Company",
  description:
    "Hire AI Employees you can actually trust. Delegate real work to role-based AI Employees that are reliable, transparent, auditable, and always under human control.",
  keywords: [
    "OWNARA",
    "AI Employee",
    "AI Workforce",
    "Business Automation",
    "Audit-First AI",
    "India AI",
  ],
  authors: [{ name: "OWNARA" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "OWNARA — India's Trusted AI Employee Company",
    description:
      "Hire AI Employees you can actually trust. Every critical action is human-approved.",
    siteName: "OWNARA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
