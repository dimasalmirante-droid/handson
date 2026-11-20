import type { ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/layout/site-chrome";

/** Public layout for shared candidate profiles. */
export default function PublicProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <AppFooter />
    </>
  );
}
