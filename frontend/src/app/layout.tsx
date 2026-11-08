import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Voice Agent | Live Conversational AI Demo",
  description:
    "Experience an interactive AI voice assistant with real-time speech recognition, streaming AI responses, and spoken replies.",
  applicationName: "AI Voice Studio",
  keywords: [
    "AI voice agent",
    "conversational AI",
    "voice assistant",
    "real-time speech recognition",
    "streaming AI",
    "spoken replies",
  ],
  authors: [{ name: "AI Voice Studio" }],
  creator: "AI Voice Studio",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AI Voice Studio",
    title: "AI Voice Agent | Live Conversational AI Demo",
    description:
      "Experience an interactive AI voice assistant with real-time speech recognition, streaming AI responses, and spoken replies.",
    images: [
      {
        url: "https://frontend-two-flame-37.vercel.app/og.jpg",
        width: 1200,
        height: 630,
        alt: "AI Voice Studio — live conversational AI demo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Voice Agent | Live Conversational AI Demo",
    description:
      "Experience an interactive AI voice assistant with real-time speech recognition, streaming AI responses, and spoken replies.",
    images: ["https://frontend-two-flame-37.vercel.app/og.jpg"],
    creator: "@AIVoiceStudio",
  },
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/x-icon" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05080f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
