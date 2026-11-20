import type { ReactNode } from "react";
import { T } from "@/i18n/client";

export function PageHeader({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[clamp(24px,3vw,30px)] tracking-[-0.03em]"><T>{title}</T></h1>
        {lead && <p className="mt-1 max-w-2xl text-[15px] text-ink-muted"><T>{lead}</T></p>}
      </div>
      {action}
    </header>
  );
}

/** White panel used to group content on dashboard pages. */
export function Panel({ title, children, id }: { title?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
      {title && <h2 className="mb-5 text-lg"><T>{title}</T></h2>}
      {children}
    </section>
  );
}
