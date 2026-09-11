import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react"; // <-- Add this import
import "./globals.css";
import Footer from "@/components/Footer";
import SmoothScrolling from "@/components/SmoothScrolling";

export const metadata: Metadata = {
  title: "Gist — turn voice notes into text you can actually scan",
  description: "Forward a long voice note, get back a clean transcript and the points that matter.",
  metadataBase: new URL("https://as-one-liart.vercel.app"),
  openGraph: {
    title: "Gist — turn voice notes into text you can actually scan",
    description: "Forward a long voice note, get back a clean transcript and the points that matter.",
    url: "https://as-one-liart.vercel.app",
    siteName: "Gist",
    images: [
      {
        url: "https://as-one-liart.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Gist - Voice Intelligence OS",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gist — turn voice notes into text you can actually scan",
    description: "Forward a long voice note, get back a clean transcript and the points that matter.",
    images: ["https://as-one-liart.vercel.app/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SmoothScrolling>
          <div className="grain" aria-hidden="true" />
          <div className="content-layer flex flex-col min-h-screen">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </SmoothScrolling>
      </body>
    </html>
  );
}