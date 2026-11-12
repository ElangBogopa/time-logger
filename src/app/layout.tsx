import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Barlow_Semi_Condensed } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The figures: ring values, scores, totals. A condensed face with tall,
// even numerals, so the numbers the app exists to show look like its own
// rather than like the body text set a little larger.
const figures = Barlow_Semi_Condensed({
  variable: "--font-figures",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Better",
  description: "Be better every day",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Better",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${figures.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
