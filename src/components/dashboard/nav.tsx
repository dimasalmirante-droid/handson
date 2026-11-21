"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/profile", label: "My profile" },
  { href: "/dashboard/cv", label: "My CV" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

/** Sidebar on desktop, scrollable tabs on mobile. */
export function DashboardNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label={t("Dashboard")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
        {DASHBOARD_NAV.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-[var(--radius-pill)] px-4 py-2 text-[15px] font-medium transition-colors lg:rounded-[12px]",
                  active ? "bg-ink text-white" : "text-ink hover:bg-indigo-soft hover:text-indigo",
                )}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
