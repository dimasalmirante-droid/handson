import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Opportunity details | Vodacom Mozambique",
  description:
    "Explore an early-career opportunity at Vodacom Mozambique through Handson.",
  robots: { index: false, follow: false },
};

const details = [
  ["Opportunity type", "Graduate opportunity"],
  ["Location", "Maputo, Mozambique"],
  ["Work model", "On-site / hybrid"],
  ["Deadline", "To be confirmed"],
];

export default function VodacomOpportunityPage() {
  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#242126]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/companies/vodacom"
            className="flex items-center gap-3"
            aria-label="Back to Vodacom careers"
          >
            <span className="text-[26px] font-extrabold tracking-[-0.08em] text-[#e60000]">
              vodacom
            </span>
            <span className="hidden border-l border-black/15 pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-black/55 sm:inline">
              Careers
            </span>
          </Link>
          <Link
            href="/companies/vodacom"
            className="text-sm font-semibold text-black/65 transition hover:text-[#e60000]"
          >
            Back to employer page
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <nav aria-label="Breadcrumb" className="text-sm text-black/50">
          <Link href="/companies/vodacom" className="hover:text-[#e60000]">
            Vodacom Mozambique
          </Link>
          <span className="mx-2">/</span>
          <span className="text-black/75">Opportunity</span>
        </nav>

        <div className="mt-8 rounded-sm border border-[#e6d9c8] bg-[#fff8e9] px-4 py-3 text-sm text-[#75521b]">
          <strong>Design preview:</strong> this is an illustrative vacancy page, not an active
          opportunity. The details below are sample content.
        </div>

        <section className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e60000]">
              Early careers · Vodacom Mozambique
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.04] tracking-[-0.05em] sm:text-6xl">
              Junior Data Analyst
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-black/65">
              Turn information into insight. Work with teams across the business, learn from
              experienced colleagues and help make better decisions through data.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black/70">
                Graduate opportunity
              </span>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black/70">
                Technology
              </span>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black/70">
                Mozambique
              </span>
            </div>
          </div>

          <aside className="border border-black/10 bg-white p-6 shadow-[0_8px_30px_rgba(36,33,38,0.04)] sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">
              Opportunity at a glance
            </p>
            <dl className="mt-5 divide-y divide-black/10">
              {details.map(([label, value]) => (
                <div key={label} className="py-4 first:pt-0 last:pb-0">
                  <dt className="text-xs font-medium text-black/45">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-black/80">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 rounded-sm bg-[#f7f5f0] p-3 text-xs leading-5 text-black/55">
              Sample information only. Final requirements and dates will be shown on each
              published vacancy.
            </p>
          </aside>
        </section>

        <div className="my-12 border-t border-black/10" />

        <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                About the opportunity
              </h2>
              <p className="mt-5 max-w-3xl leading-8 text-black/65">
                This section gives candidates a short, practical explanation of the role:
                why it exists, what the person will contribute to and how the opportunity
                fits into the team. Keep it specific and easy to scan.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                What you’ll do
              </h2>
              <ul className="mt-5 space-y-3 text-black/65">
                <li className="flex gap-3 leading-7">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e60000]" />
                  Analyse information and help teams identify useful insights.
                </li>
                <li className="flex gap-3 leading-7">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e60000]" />
                  Collaborate with colleagues on projects and business challenges.
                </li>
                <li className="flex gap-3 leading-7">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e60000]" />
                  Present findings clearly and contribute ideas for improvement.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                What we’re looking for
              </h2>
              <p className="mt-5 max-w-3xl leading-8 text-black/65">
                List only the essential study areas, skills and eligibility criteria.
                Candidates should be able to understand quickly whether they are a good fit.
              </p>
              <ul className="mt-5 space-y-3 text-black/65">
                <li className="flex gap-3 leading-7">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e60000]" />
                  Relevant degree or final-year studies in a related field.
                </li>
                <li className="flex gap-3 leading-7">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e60000]" />
                  Curiosity, problem-solving and willingness to learn.
                </li>
                <li className="flex gap-3 leading-7">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e60000]" />
                  Clear communication and ability to work with others.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                What you’ll gain
              </h2>
              <p className="mt-5 max-w-3xl leading-8 text-black/65">
                Explain the practical experience, learning, support and benefits that are
                genuinely included in this specific opportunity.
              </p>
            </section>

            <section className="border-t border-black/10 pt-8">
              <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                How applying works
              </h2>
              <ol className="mt-6 grid gap-6 sm:grid-cols-3">
                {[
                  ["01", "Apply on Handson", "Submit your profile and application."],
                  ["02", "Handson review", "Our team reviews applications and shortlists candidates."],
                  ["03", "Employer review", "Shortlisted candidates are shared with Vodacom’s authorised team."],
                ].map(([number, title, description]) => (
                  <li key={number} className="border-t-2 border-[#e60000] pt-4">
                    <span className="text-xs font-bold tracking-widest text-[#e60000]">
                      {number}
                    </span>
                    <h3 className="mt-3 font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-black/60">{description}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="h-fit border border-black/10 bg-white p-6 sm:p-7 lg:sticky lg:top-8">
            <h2 className="text-xl font-bold">Interested in this opportunity?</h2>
            <p className="mt-3 text-sm leading-6 text-black/60">
              When a vacancy is published, you’ll be able to apply using your Handson profile.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#e60000] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#bd0000]"
            >
              Create your free profile
            </Link>
            <p className="mt-4 text-center text-xs leading-5 text-black/45">
              Free registration · Your profile stays under your control
            </p>
          </aside>
        </div>
      </div>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-black/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Vodacom Mozambique careers</span>
          <Link href="/companies/vodacom" className="font-semibold hover:text-[#e60000]">
            Explore life at Vodacom
          </Link>
        </div>
      </footer>
    </main>
  );
}
