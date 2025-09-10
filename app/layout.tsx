import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/NavBar";
import Footer from "./components/Footer";
import { Orbitron } from "next/font/google";
import ConditionalBackground from "./components/ConditionalBackground";

export const metadata: Metadata = {
  title: "Tom's Website",
  description: "Created by Tom Arad",
};

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: true,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={orbitron.className}>
      <body className="h-screen flex min-h-screen flex-col bg-neutral-950">
        <Navbar />
        <div className="h-16 shrink-0" />
        <ConditionalBackground />
        <div className="flex-1">{children}</div>{" "}
        {/* This grows to push the footer down */}
        <Footer />
      </body>
    </html>
  );
}
