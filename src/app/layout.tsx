import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { defaultLocale } from "@/i18n/config";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "Handson", template: "%s | Handson" },
  description:
    "Build your early-career profile with Handson: education, skills, experience and documents in one place, private by default.",
  metadataBase: new URL(site.appUrl),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={defaultLocale} className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
