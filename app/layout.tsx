import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/components/ui/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Mahjong Together",
  description: "Play Sichuan Mahjong together.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans">
        <div className="app-col">{children}</div>
        <div className="desktop-only-msg min-h-[100dvh] flex-col items-center justify-center text-center gap-3 px-8" role="note">
          <p className="t-app text-green-text">Mahjong Together</p>
          <p className="t-body text-muted max-w-[340px]">Mahjong Together is designed for laptops and desktops. Please open this experience on a computer.</p>
        </div>
      </body>
    </html>
  );
}
