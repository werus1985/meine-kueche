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
  title: {
    default: "Meine Küche",
    template: "%s · Meine Küche",
  },
  description:
    "Küchenvorräte, Einkaufsliste und Haushaltsverwaltung – gemeinsam für die ganze Familie.",
  applicationName: "Meine Küche",
  manifest: "/manifest.webmanifest",
  other: {
    // Verhindert, dass iOS Telefonnummern/Datumsangaben im HTML automatisch
    // verlinkt und dadurch vor der Hydration das DOM verändert.
    "format-detection": "telephone=no",
  },
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
