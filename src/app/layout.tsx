import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MiniAppProvider from "@/components/MiniAppProvider";
// Remove this import: import ShareExtensionHandler from "@/components/ShareExtensionHandler";
import "./globals.css";

// Cache bust: 2025-08-23 22:15 - Force new deployment to clear X-Frame-Options

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
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CastKPR"
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
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" as="style" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MiniAppProvider>
          {/* Remove ShareExtensionHandler from here */}
          {children}
        </MiniAppProvider>
      </body>
    </html>
  );
}