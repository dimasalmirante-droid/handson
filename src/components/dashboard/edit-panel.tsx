"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

type PanelContextValue = { close: () => void };

const PanelContext = createContext<PanelContextValue | null>(null);

/** Inside an edit panel: lets a form close it after a successful save. */
export function useEditPanel(): PanelContextValue | null {
  return useContext(PanelContext);
}

/**
 * Side panel (full screen on phones) for editing one profile section.
 * Opened with ?edit=<section>; closing returns to the profile and reloads it
 * so the read view shows the saved values.
 */
export function EditPanel({
  title,
  closeHref,
  footer = true,
  children,
}: {
  title: string;
  closeHref: string;
  /** Show the panel's own "Done" button (sections whose form has no save button of its own). */
  footer?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const close = useCallback(() => {
    router.push(closeHref, { scroll: false });
    router.refresh();
  }, [router, closeHref]);

  useEffect(() => {
    headingRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  return (
    <PanelContext.Provider value={{ close }}>
      <div className="fixed inset-0 z-40 bg-ink/40" aria-hidden onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-panel-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface-raised shadow-xl sm:w-[min(640px,100vw)] sm:rounded-l-[var(--radius-lg)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <h2 id="edit-panel-title" ref={headingRef} tabIndex={-1} className="text-lg outline-none">
            {t(title)}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("Close")}
            className="flex size-9 items-center justify-center rounded-full text-xl text-ink-muted hover:bg-indigo-soft hover:text-indigo"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex justify-end border-t border-line px-5 py-4 sm:px-6">
            <Button onClick={close}>{t("Done")}</Button>
          </footer>
        )}
      </div>
    </PanelContext.Provider>
  );
}
