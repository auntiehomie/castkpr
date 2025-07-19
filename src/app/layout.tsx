import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MiniAppProvider from "@/components/MiniAppProvider";
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
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: "CastKPR - Save & Organize Farcaster Casts",
    description: "Save, organize, and recall your favorite Farcaster casts with AI-powered parsing",
    images: ['/image.png'],
  },
  other: {
    // Mini App embed for sharing
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://castkpr.vercel.app/image.png",
      button: {
        title: "Save Casts",
        action: {
          type: "launch_frame",
          name: "CastKPR",
          url: "https://castkpr.vercel.app",
          splashImageUrl: "https://castkpr.vercel.app/logo.png",
          splashBackgroundColor: "#7c3aed"
        }
      }
    }),
    // Backward compatibility
    "fc:frame": JSON.stringify({
      version: "1",
      imageUrl: "https://castkpr.vercel.app/image.png",
      button: {
        title: "Save Casts",
        action: {
          type: "launch_frame",
          name: "CastKPR",
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
      <head>
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MiniAppProvider>
          {children}
        </MiniAppProvider>
      </body>
    </html>
  );
}