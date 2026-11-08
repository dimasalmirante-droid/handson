import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/site-chrome";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Badge, Card, EmptyState, Progress, Stepper } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";

export const metadata: Metadata = { title: "Design system" };

const colours = [
  ["surface", "#F7F5F0", "bg-surface"],
  ["surface-raised", "#FFFFFF", "bg-surface-raised"],
  ["ink", "#16131F", "bg-ink"],
  ["ink-muted", "#5B5766", "bg-ink-muted"],
  ["indigo", "#3A2BD6", "bg-indigo"],
  ["indigo-soft", "#ECEAFD", "bg-indigo-soft"],
  ["lime", "#D4F25A", "bg-lime"],
  ["coral", "#FF6A4D", "bg-coral"],
  ["success", "#1D6B45", "bg-success"],
  ["warning", "#8A5300", "bg-warning"],
  ["danger", "#B42318", "bg-danger"],
  ["line", "#E4E0D6", "bg-line"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <h2 className="mb-6 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

/** Internal reference of the Handson UI components (not linked publicly, not indexed). */
export default function DesignSystemPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-indigo">Internal</p>
        <h1 className="mt-2 text-[44px] tracking-[-0.03em]">Handson design system</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Tokens and components used across the Handson app. Values match the public site at handson.cloud.
        </p>

        <Section title="Colour">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {colours.map(([name, hex, cls]) => (
              <div key={name}>
                <div className={`h-20 rounded-[14px] border border-line ${cls}`} />
                <p className="mt-2 text-sm font-semibold">{name}</p>
                <p className="text-sm text-ink-muted">{hex}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div className="space-y-4">
            <p className="font-display text-[56px] font-bold leading-[60px] tracking-[-0.03em]">Display, Bricolage Grotesque</p>
            <p className="font-display text-[40px] font-bold leading-[46px] tracking-[-0.02em]">Heading 1</p>
            <p className="font-display text-[28px] font-bold leading-[34px]">Heading 2</p>
            <p className="text-xl font-semibold">Heading 3, Inter</p>
            <p>Body text is Inter at 17px with comfortable line height for long forms and profiles.</p>
            <p className="text-sm text-ink-muted">Small text for hints and metadata.</p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <ButtonLink href="/" size="lg">Large link</ButtonLink>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
            <Field id="ds-name" label="First name" required>
              <Input id="ds-name" placeholder="Amina" />
            </Field>
            <Field id="ds-phone" label="Phone" hint="Mozambican numbers start with +258.">
              <Input id="ds-phone" type="tel" defaultValue="+258 " aria-describedby="ds-phone-hint" />
            </Field>
            <Field id="ds-province" label="Province" required>
              <Select id="ds-province" defaultValue="">
                <option value="" disabled>Select a province</option>
                <option>Maputo City</option>
                <option>Maputo Province</option>
                <option>Gaza</option>
              </Select>
            </Field>
            <Field id="ds-email" label="Email address" required error="Enter a valid email address.">
              <Input id="ds-email" type="email" defaultValue="amina@" aria-invalid="true" aria-describedby="ds-email-error" />
            </Field>
            <Field id="ds-about" label="Achievements" className="sm:col-span-2">
              <Textarea id="ds-about" placeholder="Describe what you achieved in this role." />
            </Field>
            <Checkbox id="ds-consent" label="Allow verified employers to view my profile" className="sm:col-span-2" />
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Draft</Badge>
            <Badge tone="indigo">In review</Badge>
            <Badge tone="lime">New</Badge>
            <Badge tone="success">Verified</Badge>
            <Badge tone="warning">Needs attention</Badge>
            <Badge tone="danger">Rejected</Badge>
          </div>
        </Section>

        <Section title="Progress and steps">
          <div className="max-w-3xl space-y-8">
            <Progress value={65} label="Profile completion" />
            <Stepper
              steps={[
                { label: "Personal", status: "complete" },
                { label: "Education", status: "complete" },
                { label: "Skills", status: "current" },
                { label: "Interests", status: "upcoming" },
                { label: "Experience", status: "upcoming" },
                { label: "Documents", status: "upcoming" },
              ]}
            />
          </div>
        </Section>

        <Section title="Alerts">
          <div className="grid max-w-3xl gap-3">
            <Alert tone="info" title="Your progress is saved automatically">You can leave and continue later.</Alert>
            <Alert tone="success" title="Document uploaded">Your CV is stored privately.</Alert>
            <Alert tone="warning" title="Two sections need attention">Add your experience and documents.</Alert>
            <Alert tone="danger" title="Upload failed">Files must be PDF, DOCX, JPG or PNG and under 5 MB.</Alert>
          </div>
        </Section>

        <Section title="Cards and empty states">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <Badge tone="indigo">Education</Badge>
              <h3 className="mt-4 text-xl">BSc Accounting</h3>
              <p className="mt-1 text-ink-muted">Example university · 2023–2027 (expected)</p>
            </Card>
            <EmptyState title="No experience added yet" action={<Button size="sm">Add experience</Button>}>
              Internships, volunteering, university projects and extracurricular activities all count.
            </EmptyState>
          </div>
        </Section>
      </main>
    </>
  );
}
