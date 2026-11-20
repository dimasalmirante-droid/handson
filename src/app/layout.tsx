import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { I18nProvider } from "@/i18n/client";
import { getLocale } from "@/i18n/server";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "Handson", template: "%s | Handson" },
  description:
    "Crie o seu perfil de início de carreira na Handson: formação, competências, experiência e documentos num só lugar, privado por defeito.",
  metadataBase: new URL(site.appUrl),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full">
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
