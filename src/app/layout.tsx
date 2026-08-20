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
  title: "OWNARA — Governed AI for Business Responsibilities",
  description:
    "OWNARA is an AI system that owns persistent business responsibilities under bounded authority. Transparent, auditable, and always under human control.",
  keywords: [
    "OWNARA",
    "Governed AI",
    "Delegated Responsibilities",
    "Bounded Authority",
    "Audit-First AI",
    "Accounts Receivable",
    "Finance Operator",
  ],
  authors: [{ name: "OWNARA" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "OWNARA — Governed AI for Business Responsibilities",
    description:
      "OWNARA is an AI system that owns persistent business responsibilities under bounded authority. Every critical action is human-approved.",
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
