import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fair-lease-auditor-final.vercel.app"),
  title: {
    default: "FairLease Auditor",
    template: "%s | FairLease Auditor",
  },
  description: "AI-powered rental agreement auditing platform for tenant risk detection.",
  applicationName: "FairLease Auditor",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "FairLease Auditor",
    description: "AI-powered rental agreement auditing platform for tenant risk detection.",
    url: "https://fair-lease-auditor-final.vercel.app",
    siteName: "FairLease Auditor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FairLease Auditor",
    description: "AI-powered rental agreement auditing platform for tenant risk detection.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
