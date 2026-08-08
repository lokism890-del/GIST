import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Gist — turn voice notes into text you can actually scan",
  description:
    "Forward a long voice note, get back a clean transcript and the points that matter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="grain" aria-hidden="true" />
        <div className="content-layer flex flex-col min-h-screen">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
