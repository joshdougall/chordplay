import "./globals.css";
import type { Metadata } from "next";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Chordplay",
  description: "Chord sheets and tabs that follow Spotify playback"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen bg-neutral-950 text-neutral-100">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
