import type { Metadata } from "next";
import "./globals.css";

import { Outfit, Playfair_Display, Afacad, Inter } from "next/font/google";

// PropFyndr App Root Layout — PostHog & Telemetry Enabled
import { PostHogProvider } from "@/components/PostHogProvider";
import ThemedToaster from "@/components/ThemedToaster";
import { PingBackend } from "@/components/PingBackend";
import CookiesBanner from "@/components/CookiesBanner";
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'
import ProgressBar from '@/components/ProgressBar'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  preload: true,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
});

const afacad = Afacad({
  subsets: ["latin"],
  variable: "--font-afacad",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  // TODO: confirm production domain — no NEXT_PUBLIC_SITE_URL/similar env var found in this codebase; using propfyndr.com as a placeholder (matches storage.propfyndr.com already referenced in next.config.js).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://propfyndr.com'),
  title: {
    default: "PropFyndr — AI Property Advisor for Noida",
    template: "%s | PropFyndr",
  },
  description: "Find, compare, and evaluate Noida real estate with AI. Get honest project analysis, EMI calculations, and builder track records — in plain language.",
  keywords: ["Noida real estate", "property advisor", "AI property search", "buy flat Noida", "Sector 150", "RERA registered"],
  openGraph: {
    title: "PropFyndr — AI Property Advisor for Noida",
    description: "Find, compare, and evaluate Noida real estate with AI.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/images/icons/logo-square-black.png", media: "(prefers-color-scheme: light)" },
      { url: "/images/icons/logo-square-white.png", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/images/icons/logo-square-black.png",
    apple: "/images/icons/apple-icon.png",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PropFyndr',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover' as const,
  interactiveWidget: 'resizes-content' as const,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable} ${playfair.variable} ${afacad.variable} font-sans`}>
      <head>
        {/* Applies the stored theme before first paint. ThemeToggle sets it in a
            useEffect, which runs after hydration — so dark-mode users got a
            white flash on every navigation. Must stay in sync with ThemeToggle:
            light is the default, dark only when explicitly stored. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased glass-app font-sans relative text-foreground bg-[#E4E4E5]">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:p-4 focus:bg-white focus:text-blue-600 focus:font-bold">
          Skip to main content
        </a>
        <ProgressBar />
        <PingBackend />
        {/* reducedMotion="user" makes every `m.*` component in the app honour
            the OS "reduce motion" setting: transform and layout animations are
            dropped, opacity still cross-fades. Nothing respected that before,
            and framer-motion drives most of the movement here. CSS-driven
            animation is handled by the matching block in globals.css. */}
        <MotionConfig reducedMotion="user">
          <LazyMotion features={domAnimation}>
            <PostHogProvider>{children}</PostHogProvider>
          </LazyMotion>
        </MotionConfig>
        <ThemedToaster />
        <CookiesBanner />

      </body>
    </html>
  );
}
