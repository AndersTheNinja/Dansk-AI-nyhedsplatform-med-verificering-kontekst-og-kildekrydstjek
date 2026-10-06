import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ØL.dk — Øjeblikkelig & Lødig",
  description: "ØL.dk — danske nyheder med resumé og faktatjek."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
