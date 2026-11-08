import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-paper.css";

export const metadata: Metadata = {
  title: "LiquidScribe — A little room for your thoughts",
  description: "A local-first writing space with thoughtful Markdown editing, private assistance, and room for your next idea.",
  applicationName: "LiquidScribe",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
