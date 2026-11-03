import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FINN — Your portfolio, in focus",
  description:
    "The signal in your portfolio. Evidence-led investment briefings and primary-source company research.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
