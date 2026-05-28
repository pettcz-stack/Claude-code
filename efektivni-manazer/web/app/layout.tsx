import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Efektivní manažer",
  description: "Tracking úkolů z emailu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="bg-bg text-ink">{children}</body>
    </html>
  );
}
