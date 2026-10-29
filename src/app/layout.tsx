import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nebius CodeSentinel — NVIDIA Nemotron Autonomous Code Healing",
  description:
    "Autonomous Code Audit & Self-Healing Agent powered by Nebius Token Factory and NVIDIA Nemotron MoE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
