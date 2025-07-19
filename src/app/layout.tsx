// src/app/layout.tsx
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
  title: "CastKPR - Save & Organize Farcaster Casts",
  description: "Save, organize, and recall your favorite Farcaster casts with AI-powered parsing",
  other: {
    // Mini App embed for sharing
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://castkpr.vercel.app/image.png",
      button: {
        title: "save it",
        action: {
          type: "launch_miniapp", 
          name: "CASTKPR",
          url: "https://castkpr.vercel.app",
          splashImageUrl: "https://castkpr.vercel.app/logo.png",
          splashBackgroundColor: "#7c3aed"
        }
      }
    })
  }
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