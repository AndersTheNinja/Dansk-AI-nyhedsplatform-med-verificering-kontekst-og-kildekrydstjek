import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KONTEKST — AI-check af danske nyheder",
  description: "Dansk AI-nyhedsplatform med kildekrydstjek, kontekst og verificering."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
