import type { ReactNode } from "react";

export function PageHeader({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[clamp(28px,4vw,36px)] tracking-[-0.03em]">{title}</h1>
        {lead && <p className="mt-2 max-w-2xl text-ink-muted">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

/** White panel used to group content on dashboard pages. */
export function Panel({ title, children, id }: { title?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-8">
      {title && <h2 className="mb-6 text-xl">{title}</h2>}
      {children}
    </section>
  );
}
