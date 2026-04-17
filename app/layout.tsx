import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chordplay",
  description: "Chord sheets and tabs that follow Spotify playback"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
