"use client";

import { useState, useTransition } from "react";
import { setPublicProfile, type SettingsResult } from "@/app/(app)/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, describedBy } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { PUBLIC_SECTIONS, type PublicSection } from "@/lib/validation/profile";

const SECTION_LABELS: Record<PublicSection, string> = {
  photo: "Profile photo",
  headline: "Professional headline",
  summary: "Short summary",
  location: "District and province",
  education: "Education",
  experience: "Experience",
  skills: "Skills",
  languages: "Languages",
  linkedin: "LinkedIn link",
};

const DEFAULT_SECTIONS: PublicSection[] = ["photo", "headline", "summary", "location", "education", "experience", "skills", "languages"];

/**
 * Opt-in public profile: an address the student can share (WhatsApp,
 * LinkedIn, email), showing only the sections they tick. Email and phone are
 * never shown.
 */
export function PublicProfileForm({
  initial,
  suggestedSlug,
  baseUrl,
}: {
  initial: { enabled: boolean; slug: string | null; sections: string[] };
  suggestedSlug: string;
  baseUrl: string;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [slug, setSlug] = useState(initial.slug ?? suggestedSlug);
  const [sections, setSections] = useState<string[]>(initial.slug ? initial.sections : DEFAULT_SECTIONS);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const url = `${baseUrl}/p/${saved.slug ?? slug}`;
  const dirty = enabled !== saved.enabled || slug !== (saved.slug ?? suggestedSlug) || sections.join() !== saved.sections.join();

  const save = (nextEnabled = enabled) =>
    start(async () => {
      const r = await setPublicProfile({ enabled: nextEnabled, slug, sections });
      setResult(r);
      if (r.ok) {
        setEnabled(nextEnabled);
        setSaved({ enabled: nextEnabled, slug: r.slug ?? slug, sections: [...sections].sort() });
        setSections((s) => [...s].sort());
      }
    });

  const toggle = (key: string) => setSections((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p id="public-label" className="font-semibold">Share a public profile link</p>
          <p id="public-desc" className="mt-1 text-[15px] text-ink-muted">
            {saved.enabled
              ? "Anyone with the link can see the sections you choose below. Your email address and phone number are never shown."
              : "Off. Turn it on to get a link you can send to employers on WhatsApp, email or LinkedIn."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="public-label"
          aria-describedby="public-desc"
          disabled={pending}
          onClick={() => (saved.enabled ? save(false) : setEnabled(!enabled))}
          className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60", enabled ? "bg-indigo" : "bg-line-strong")}
        >
          <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-[left]", enabled ? "left-7" : "left-1")} />
        </button>
      </div>

      {result?.message && (
        <Alert tone={result.ok ? "success" : "danger"} className="mt-5">{result.message}</Alert>
      )}

      {saved.enabled && saved.slug && (
        <div className="mt-5 flex flex-col gap-3 rounded-[14px] bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <a href={url} target="_blank" rel="noopener" className="break-all font-semibold text-indigo hover:underline">{url}</a>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
            <a
              className="inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-semibold text-ink hover:bg-indigo-soft hover:text-indigo"
              href={`https://wa.me/?text=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      )}

      {enabled && (
        <div className="mt-6 flex flex-col gap-6">
          <Field
            id="public-slug"
            label="Your profile address"
            hint="Lowercase letters, numbers and hyphens. Changing it stops the old link from working."
            error={result?.fields?.slug}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[15px] text-ink-muted">{baseUrl.replace(/^https?:\/\//, "")}/p/</span>
              <Input
                id="public-slug"
                value={slug}
                maxLength={40}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                aria-invalid={result?.fields?.slug ? true : undefined}
                aria-describedby={describedBy("public-slug", { hint: true, error: result?.fields?.slug })}
              />
            </div>
          </Field>

          <fieldset>
            <legend className="text-[15px] font-semibold">What to show</legend>
            <p className="mt-1 text-sm text-ink-muted">Your name is always shown. Email and phone are never shown.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PUBLIC_SECTIONS.map((key) => (
                <Checkbox
                  key={key}
                  id={`public-${key}`}
                  label={SECTION_LABELS[key]}
                  checked={sections.includes(key)}
                  onChange={() => toggle(key)}
                />
              ))}
            </div>
          </fieldset>

          <div>
            <Button type="button" disabled={pending || (!dirty && saved.enabled)} onClick={() => save(true)}>
              {saved.enabled ? "Save changes" : "Turn on public profile"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
