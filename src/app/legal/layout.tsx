import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/layout/site-chrome";

/** Public layout for the Terms and Privacy Notice. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <AppFooter />
    </>
  );
}
