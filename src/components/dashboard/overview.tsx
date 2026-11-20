import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { Catalogues } from "@/lib/data/catalogues";
import type { Completion, DocumentRecord, EducationRecord, Notification, StudentProfile } from "@/lib/data/student";
import { changesHref, openTasks } from "@/lib/dashboard/tasks";
import { T } from "@/i18n/client";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";

const dateLabel = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "short", timeZone: "Africa/Maputo" });

export type OverviewProps = {
  profile: StudentProfile;
  photoUrl: string | null;
  completion: Completion | null;
  education: EducationRecord[];
  documents: DocumentRecord[];
  notifications: Notification[];
  catalogues: Catalogues;
  notice?: string;
  locale: Locale;
};

/** Dashboard home: one next step, the completion, the verification status, and the rest of the to-do list. */
export function Overview({ profile, photoUrl, completion, education, documents, notifications, catalogues, notice, locale }: OverviewProps) {
  const initials = `${profile.first_name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const total = completion?.total ?? 0;
  const tasks = openTasks(profile, completion);
  const [next, ...rest] = tasks;

  const latestEducation = education[0];
  const studying = latestEducation
    ? [
        latestEducation.qualification_name || catalogues.qualificationTypes.find((q) => q.id === latestEducation.qualification_type_id)?.name,
        catalogues.institutions.find((i) => i.id === latestEducation.institution_id)?.shortName ??
          catalogues.institutions.find((i) => i.id === latestEducation.institution_id)?.name ??
          latestEducation.institution_name_other,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {notice === "onboarding-complete" && (
        <Alert tone="success" title="Your profile is set up">
          <T>{"You can keep improving it at any time. It stays private until you choose to share it."}</T>
        </Alert>
      )}
      {notice === "password-updated" && <Alert tone="success"><T>{"Your password has been updated."}</T></Alert>}

      <header className="flex items-center gap-4">
        <div className="size-12 shrink-0 overflow-hidden rounded-full bg-lime">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-display text-lg font-bold" aria-hidden>{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-[clamp(24px,3vw,30px)] tracking-[-0.03em]">
            <T>{"Hi"}</T>{profile.first_name ? `, ${profile.first_name}` : ""}
          </h1>
          {studying && <p className="truncate text-[15px] text-ink-muted">{studying}</p>}
        </div>
      </header>

      <section aria-labelledby="next-step" className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold text-ink-muted">{next ? <T>{"Next step"}</T> : <T>{"All done"}</T>}</p>
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{total}%</span> <T>{"complete"}</T>
          </p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-soft"
          role="progressbar"
          aria-valuenow={total}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="next-step"
        >
          <div className="h-full rounded-full bg-indigo" style={{ width: `${total}%` }} />
        </div>
        {next ? (
          <>
            <h2 id="next-step" className="mt-5 text-xl"><T>{next.title}</T></h2>
            <p className="mt-1 max-w-xl text-[15px] text-ink-muted"><T>{next.why}</T></p>
            <ButtonLink href={next.href} className="mt-5"><T>{next.action}</T></ButtonLink>
          </>
        ) : (
          <>
            <h2 id="next-step" className="mt-5 text-xl"><T>{"Your profile is complete"}</T></h2>
            <p className="mt-1 max-w-xl text-[15px] text-ink-muted">
              <T>{"Keep it up to date as you study and gain experience. Your CV updates with it."}</T>
            </p>
            <ButtonLink href="/dashboard/cv" className="mt-5"><T>{"Download your CV"}</T></ButtonLink>
          </>
        )}
      </section>

      <VerificationLine status={profile.verification_status} href={changesHref(education, documents)} />

      {rest.length > 0 && (
        <section aria-labelledby="also-to-do">
          <h2 id="also-to-do" className="mb-2 text-base font-semibold"><T>{"Also to do"}</T></h2>
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface-raised">
            {rest.slice(0, 4).map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="flex items-center justify-between gap-4 px-5 py-3.5 text-[15px] hover:text-indigo">
                  <T>{t.title}</T>
                  <span aria-hidden className="text-ink-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notifications.length > 0 && (
        <details className="group rounded-[var(--radius-lg)] border border-line bg-surface-raised">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-[15px] font-semibold">
            <span>
              <T>{"Updates from Handson"}</T>
              {notifications.some((n) => !n.read_at) && <span className="ml-2 inline-block size-2 rounded-full bg-indigo align-middle" aria-hidden />}
            </span>
            <span aria-hidden className="text-ink-muted transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-[15px]"><T>{n.title}</T></p>
                  {n.body && <p className="text-sm text-ink-muted"><T>{n.body}</T></p>}
                </div>
                <span className="shrink-0 text-sm text-ink-muted">{dateLabel(n.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** One quiet line about verification; nothing while the profile has not been reviewed. */
function VerificationLine({ status, href }: { status: string; href: string }) {
  if (status === "rejected") {
    return (
      <p className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-line bg-surface-raised px-5 py-3.5 text-[15px]">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
        <span>
          <strong className="font-semibold"><T>{"Handson asked for a change."}</T></strong>{" "}
          <span className="text-ink-muted"><T>{"Some information could not be verified."}</T></span>{" "}
          <Link href={href} className="font-semibold text-indigo hover:underline"><T>{"Review it"}</T></Link>
        </span>
      </p>
    );
  }
  if (status === "pending") {
    return (
      <p className="flex items-center gap-3 px-1 text-[15px] text-ink-muted">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-indigo" />
        <T>{"Handson is reviewing your profile."}</T>
      </p>
    );
  }
  if (status === "verified") {
    return (
      <p className="flex items-center gap-3 px-1 text-[15px] text-ink-muted">
        <span aria-hidden className="text-success">✓</span>
        <T>{"Your profile has been verified by Handson."}</T>
      </p>
    );
  }
  return null;
}
