import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Careers at Vodacom Mozambique",
  description:
    "Discover careers, graduate opportunities and internships at Vodacom Mozambique. Grow your ambition and make an impact with technology.",
  robots: { index: true, follow: true },
};

const images = {
  hero: "https://website-cms.api.prod.ind.vm.co.mz/uploads/VF_Purpose_Banner_b15af4f108.png",
  graduates:
    "https://website-cms.api.prod.ind.vm.co.mz/uploads/large_Ratio_16_9_ZA_Brand_Photography_Graduate_Taking_a_Selfie_FY_21_07_92059_CBU_F_PHO_MSTBRND_AO_AL_00_EN_GN_00_0163_fba82be7f6.jpg",
  innovation:
    "https://website-cms.api.prod.ind.vm.co.mz/uploads/large_Young_women_using_innovation_hardware_e37cdd0776.jpg",
};

const opportunities = [
  "Technology",
  "Digital",
  "Vodacom Business",
  "Retail",
  "Customer Service & Operations",
  "M-PESA",
  "Bazara",
];

const recruitmentAreas = [
  "Agile squads",
  "Software engineering",
  "Data analytics",
  "Finance, Legal & HR",
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function VodacomCareersPage() {
  return (
    <main className="min-h-screen bg-white text-[#242126]">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/companies/vodacom" aria-label="Vodacom careers home" className="flex items-center gap-3">
            <span className="text-[27px] font-extrabold tracking-[-0.08em] text-[#e60000]">vodacom</span>
            <span className="hidden border-l border-black/15 pl-3 text-xs font-semibold uppercase tracking-[0.18em] text-black/55 sm:inline">
              Mozambique
            </span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-semibold md:flex">
            <a href="#purpose" className="hover:text-[#e60000]">Our purpose</a>
            <a href="#life" className="hover:text-[#e60000]">Life at Vodacom</a>
            <a href="#grow" className="hover:text-[#e60000]">Grow with us</a>
            <a href="#opportunities" className="hover:text-[#e60000]">Opportunities</a>
          </nav>
          <Link
            href="/register"
            className="rounded-full bg-[#e60000] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#bd0000]"
          >
            Create your profile
          </Link>
        </div>
      </header>

      <section
        className="relative isolate flex min-h-[620px] items-end overflow-hidden bg-[#242126] text-white sm:min-h-[700px]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(20,14,18,.88) 0%, rgba(20,14,18,.55) 52%, rgba(20,14,18,.12) 100%), url("${images.hero}")`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-28 sm:px-8 sm:pb-24">
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-[#ff7777]">
            Careers · Vodacom Mozambique
          </p>
          <h1 className="max-w-4xl text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-[88px]">
            Your ambition.
            <br />
            Your future.
            <br />
            <span className="text-[#ff3333]">Your impact.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-white/85 sm:text-xl">
            Bring your ideas, curiosity and energy. Help us use technology to connect people,
            create opportunities and make a difference in Mozambique.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#opportunities" className="inline-flex items-center justify-center gap-3 rounded-full bg-[#e60000] px-7 py-4 text-sm font-bold text-white hover:bg-[#bd0000]">
              Explore opportunities <Arrow />
            </a>
            <a href="#life" className="inline-flex items-center justify-center rounded-full border border-white/60 px-7 py-4 text-sm font-bold text-white hover:bg-white/10">
              Discover life at Vodacom
            </a>
          </div>
        </div>
        <div className="absolute bottom-7 right-8 hidden text-right text-xs uppercase tracking-[0.2em] text-white/70 lg:block">
          Connecting people<br />to make Mozambique grow
        </div>
      </section>

      <section id="purpose" className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-32">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e60000]">More than connectivity</p>
          <h2 className="mt-5 max-w-lg text-4xl font-bold leading-tight tracking-[-0.045em] sm:text-6xl">
            Technology is powerful when it moves people forward.
          </h2>
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xl leading-9 text-black/70">
            Our purpose is to empower people through connectivity and access to technology,
            digital and financial inclusion — supporting individual growth and the development
            of Mozambique.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["01", "Empower people", "Expand access, opportunity and inclusion."],
              ["02", "Protect the planet", "Build progress with care for our environment."],
              ["03", "Earn trust", "Act responsibly, ethically and transparently."],
            ].map(([number, title, description]) => (
              <article key={number} className="border-t-2 border-[#e60000] pt-5">
                <span className="text-xs font-bold tracking-widest text-[#e60000]">{number}</span>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/60">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="life" className="bg-[#f5f3f1]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-28">
          <div
            role="img"
            aria-label="Young people taking part in a Vodacom graduate experience"
            className="min-h-[360px] rounded-sm bg-cover bg-center sm:min-h-[520px]"
            style={{ backgroundImage: `url("${images.graduates}")` }}
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e60000]">Life at Vodacom</p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-6xl">
              Different perspectives. One shared purpose.
            </h2>
            <p className="mt-7 text-lg leading-8 text-black/65">
              We bring people together to learn, collaborate and turn ideas into action.
              Our people and culture are central to how we serve customers and contribute
              to the country’s digital future.
            </p>
            <a href="https://www.vm.co.mz/vodacom" target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-3 border-b-2 border-[#e60000] pb-2 text-sm font-bold hover:text-[#e60000]">
              Explore Vodacom Mozambique <Arrow />
            </a>
          </div>
        </div>
      </section>

      <section id="grow" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e60000]">Your next chapter</p>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-6xl">Grow with us.</h2>
          <p className="mt-6 text-lg leading-8 text-black/65">
            Whether you are starting your career or ready for a new challenge, discover
            opportunities to build skills, learn from experienced people and contribute
            to real work.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <article className="group overflow-hidden bg-[#f5f3f1]">
            <div
              role="img"
              aria-label="Graduate programme participants"
              className="h-64 bg-cover bg-center transition duration-500 group-hover:scale-[1.02]"
              style={{ backgroundImage: `url("${images.graduates}")` }}
            />
            <div className="p-8 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e60000]">Early careers · 2 years</p>
              <h3 className="mt-4 text-3xl font-bold">Graduate programme</h3>
              <p className="mt-4 leading-7 text-black/65">
                A two-year rotational experience across business areas, with technical and
                leadership development, coaching, mentoring and opportunities to contribute
                to real projects.
              </p>
              <a href="https://www.vm.co.mz/vodacom/artigo/programa-de-graduados" target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-3 text-sm font-bold hover:text-[#e60000]">
                Programme details <Arrow />
              </a>
            </div>
          </article>
          <article className="group overflow-hidden bg-[#f5f3f1]">
            <div
              role="img"
              aria-label="Young women exploring technology and innovation"
              className="h-64 bg-cover bg-center transition duration-500 group-hover:scale-[1.02]"
              style={{ backgroundImage: `url("${images.innovation}")` }}
            />
            <div className="p-8 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e60000]">Early careers · 12 months</p>
              <h3 className="mt-4 text-3xl font-bold">Internship programme</h3>
              <p className="mt-4 leading-7 text-black/65">
                A paid, 12-month programme offering practical experience in your field,
                guided by experienced professionals and designed to help you develop
                in a technology-driven environment.
              </p>
              <a href="https://www.vm.co.mz/vodacom/artigo/programa-de-estagios" target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-3 text-sm font-bold hover:text-[#e60000]">
                Programme details <Arrow />
              </a>
            </div>
          </article>
        </div>
        <div className="mt-8 rounded-sm bg-[#242126] p-8 text-white sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7777]">Keep learning</p>
              <h3 className="mt-4 text-3xl font-bold">Development does not stop at day one.</h3>
            </div>
            <p className="text-lg leading-8 text-white/75">
              Vodacom highlights learning platforms such as Grow With Vodacom, alongside
              mentoring and collaboration with external trainers, to help people strengthen
              technical capabilities, gain new experiences and generate ideas together.
              <a href="https://www.vm.co.mz/vodacom/artigo/desenvolvimento-de-carreira" target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-2 font-bold text-white underline decoration-[#e60000] decoration-2 underline-offset-4">
                Discover career development <Arrow />
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#e60000] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Make an impact</p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-6xl">
              Bring your ideas to life.
            </h2>
          </div>
          <div>
            <p className="text-xl leading-9 text-white/90">
              From digital services and financial inclusion to innovation and customer
              experience, our teams work on challenges that matter to people and businesses
              across Mozambique.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {opportunities.map((item) => (
                <span key={item} className="rounded-full border border-white/45 px-4 py-2 text-sm font-semibold">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="opportunities" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[1fr_.85fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e60000]">Find your place</p>
            <h2 className="mt-5 max-w-2xl text-4xl font-bold tracking-[-0.045em] sm:text-6xl">
              Your next opportunity starts here.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-black/65">
              Create your Handson profile so you are ready to apply when opportunities
              from Vodacom Mozambique are published here.
            </p>
          </div>
          <div className="border-l-4 border-[#e60000] bg-[#f5f3f1] p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e60000]">Coming to Handson</p>
            <h3 className="mt-3 text-2xl font-bold">Vodacom opportunities</h3>
            <p className="mt-3 leading-7 text-black/65">
              Vacancies will appear here when they are published. Applications submitted
              through Handson are first reviewed by the Handson team. Shortlisted candidates
              are then shared with the company’s authorised recruitment team.
            </p>
            <Link href="/register" className="mt-7 inline-flex items-center justify-center gap-3 rounded-full bg-[#e60000] px-6 py-3 text-sm font-bold text-white hover:bg-[#bd0000]">
              Create your free profile <Arrow />
            </Link>
          </div>
        </div>
        <div className="mt-16 border-t border-black/15 pt-8 text-sm text-black/55">
          Explore official information:{" "}
          <a className="font-semibold text-black underline underline-offset-4 hover:text-[#e60000]" href="https://careers.vodafone.com/mozambique/" target="_blank" rel="noreferrer">Vodafone Careers — Mozambique</a>
          {" · "}
          <a className="font-semibold text-black underline underline-offset-4 hover:text-[#e60000]" href="https://www.vm.co.mz/vodacom" target="_blank" rel="noreferrer">Vodacom Mozambique</a>
        </div>
      </section>

      <footer className="bg-[#242126] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-2xl font-extrabold tracking-[-0.08em] text-[#ff3333]">vodacom</span>
            <p className="mt-2 text-sm text-white/55">Careers in Mozambique</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-white/70">
            <a href="https://www.vm.co.mz/vodacom" target="_blank" rel="noreferrer" className="hover:text-white">Vodacom website</a>
            <a href="https://handson.cloud" target="_blank" rel="noreferrer" className="hover:text-white">Powered by Handson</a>
            <Link href="/register" className="hover:text-white">Create profile</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
