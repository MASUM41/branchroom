import type { Metadata } from "next";
import "./globals.css";
import "./branchroom.css";

export const metadata: Metadata = {
  title: "Branchroom — Follow your curiosity",
  description: "Explore a question, branch into an explanation, and keep your place. Your personal learning tree.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
