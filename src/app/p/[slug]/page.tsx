import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/feedback";
import { getPublicPhotoUrl, getPublicProfile } from "@/lib/data/public-profile";

/** Shared profiles are for people the student sends the link to, not for search engines. */
const ROBOTS: Metadata["robots"] = { index: false, follow: false };

const STATUS: Record<string, string> = {
  enrolled: "Em curso",
  graduated: "Concluído",
  deferred: "Interrompido",
  discontinued: "Não concluído",
};
const EXPERIENCE: Record<string, string> = {
  internship: "Estágio",
  part_time: "Tempo parcial",
  full_time: "Tempo inteiro",
  volunteering: "Voluntariado",
  university_project: "Projecto académico",
  extracurricular: "Actividade extracurricular",
  freelance: "Trabalho independente",
  other: "Outro",
};
const PROFICIENCY: Record<string, string> = { beginner: "Iniciante", intermediate: "Intermédio", advanced: "Avançado", expert: "Especialista" };
const LEVEL: Record<string, string> = { basic: "Básico", intermediate: "Intermédio", advanced: "Avançado", fluent: "Fluente", native: "Nativo" };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const monthYear = (d: string | null) => {
  if (!d) return null;
  const [y, m] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) return { title: "Perfil não encontrado", robots: ROBOTS };
  const name = [p.first_name, p.surname].filter(Boolean).join(" ");
  return { title: name, description: p.headline ?? undefined, robots: ROBOTS };
}

function Heading({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-indigo">{children}</h2>;
}

export default async function PublicProfilePage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) notFound();

  const name = [p.first_name, p.surname].filter(Boolean).join(" ");
  const photo = await getPublicPhotoUrl(p.photo_path);
  const initials = `${p.first_name?.[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const location = p.location ? [p.location.district ?? p.location.city, p.location.province_pt].filter(Boolean).join(", ") : null;

  return (
    <article lang="pt" className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {p.sections.includes("photo") &&
          (photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={photo} alt="" className="size-24 shrink-0 rounded-full object-cover" />
          ) : (
            <div aria-hidden className="grid size-24 shrink-0 place-items-center rounded-full bg-indigo-soft text-2xl font-semibold text-indigo">
              {initials}
            </div>
          ))}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[clamp(28px,4vw,38px)] tracking-[-0.03em]">{name}</h1>
            {p.verified && <Badge tone="success">Perfil verificado pela Handson</Badge>}
          </div>
          {p.headline && <p className="mt-1 text-lg font-medium text-indigo">{p.headline}</p>}
          {(location || p.linkedin_url) && (
            <p className="mt-1 text-[15px] text-ink-muted">
              {location}
              {location && p.linkedin_url ? " · " : ""}
              {p.linkedin_url && (
                <a href={p.linkedin_url} className="font-semibold text-indigo hover:underline" target="_blank" rel="noopener noreferrer nofollow">
                  LinkedIn
                </a>
              )}
            </p>
          )}
        </div>
      </header>

      {p.summary && (
        <section>
          <Heading>Perfil</Heading>
          <p className="whitespace-pre-line">{p.summary}</p>
        </section>
      )}

      {p.education && p.education.length > 0 && (
        <section>
          <Heading>Formação académica</Heading>
          <ul className="flex flex-col gap-4">
            {p.education.map((e, i) => {
              const qualification = e.qualification_name || e.qualification_pt;
              const title = e.field_pt && !qualification.toLowerCase().includes(e.field_pt.toLowerCase()) ? `${qualification} em ${e.field_pt}` : qualification;
              const years = e.end_year ? `${e.start_year} – ${e.end_year}` : e.status === "enrolled" ? `${e.start_year} – presente` : String(e.start_year);
              return (
                <li key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="font-semibold">
                      {title} {e.verified && <Badge tone="success" className="ml-1 align-middle">Verificado</Badge>}
                    </p>
                    <p className="text-sm text-ink-muted">{years}</p>
                  </div>
                  <p className="text-[15px] text-ink-muted">
                    {[e.institution, e.status !== "graduated" ? STATUS[e.status] : null].filter(Boolean).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {p.experience && p.experience.length > 0 && (
        <section>
          <Heading>Experiência</Heading>
          <ul className="flex flex-col gap-4">
            {p.experience.map((x, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold">{x.role_title}</p>
                  <p className="text-sm text-ink-muted">
                    {monthYear(x.start_date)} – {x.is_current ? "presente" : monthYear(x.end_date)}
                  </p>
                </div>
                <p className="text-[15px] text-ink-muted">{[x.organisation, EXPERIENCE[x.type], x.location].filter(Boolean).join(" · ")}</p>
                {x.description && <p className="mt-1 whitespace-pre-line text-[15px]">{x.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.skills && p.skills.length > 0 && (
        <section>
          <Heading>Competências</Heading>
          <ul className="flex flex-wrap gap-2">
            {p.skills.map((k, i) => (
              <li key={i} className="rounded-[var(--radius-pill)] bg-surface px-3 py-1.5 text-[15px] ring-1 ring-inset ring-line">
                {k.name_pt} <span className="text-ink-muted">· {PROFICIENCY[k.proficiency] ?? k.proficiency}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.languages && p.languages.length > 0 && (
        <section>
          <Heading>Línguas</Heading>
          <ul className="flex flex-wrap gap-2">
            {p.languages.map((l, i) => (
              <li key={i} className="rounded-[var(--radius-pill)] bg-surface px-3 py-1.5 text-[15px] ring-1 ring-inset ring-line">
                {l.name_pt} <span className="text-ink-muted">· {LEVEL[l.level] ?? l.level}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-line pt-6 text-sm text-ink-muted">
        Perfil partilhado pelo próprio candidato através da Handson. Os contactos são partilhados apenas pelo candidato.
      </footer>
    </article>
  );
}
