import "./globals.css";
import type { Metadata } from "next";
import { Lora, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/Header";

const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-brand", weight: "400" });

export const metadata: Metadata = {
  title: "Chordplay",
  description: "Chord sheets and tabs that follow Spotify playback"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${jetbrains.variable} flex flex-col h-screen`} style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
