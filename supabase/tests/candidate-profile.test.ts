/**
 * Candidate basics: districts, headline and summary, languages, profile
 * completion and the public profile (migration 20261119000100).
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, as, createDb, expectDenied, makeAdmin, signUp } from "./harness";

let db: PGlite;
let amina: string;
let bento: string;
let admin: string;
let maputoCity: number;
let gaza: number;
let kaMpfumo: number;
let chokwe: number;

beforeAll(async () => {
  db = await createDb();
  amina = await signUp(db, { email: "amina@example.com", meta: { first_name: "Amina", surname: "Macuácua" } });
  bento = await signUp(db, { email: "bento@example.com", meta: { first_name: "Bento", surname: "Sitoe" } });
  admin = await signUp(db, { email: "admin@handson.cloud" });
  await makeAdmin(db, admin, "admin");
  const prov = (await db.query<{ id: number; code: string }>("select id, code from public.provinces")).rows;
  maputoCity = prov.find((p) => p.code === "MPM")!.id;
  gaza = prov.find((p) => p.code === "GAZ")!.id;
  kaMpfumo = (await db.query<{ id: number }>("select id from public.districts where name = 'KaMpfumo'")).rows[0].id;
  chokwe = (await db.query<{ id: number }>("select id from public.districts where name = 'Chókwè'")).rows[0].id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("defaults", () => {
  it("new profiles default to Portuguese", async () => {
    const { rows } = await db.query<{ preferred_locale: string }>("select preferred_locale from public.profiles where id = $1", [amina]);
    expect(rows[0].preferred_locale).toBe("pt");
  });
});

describe("districts", () => {
  it("are seeded for every province", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(distinct province_id)::int n from public.districts",
    );
    expect(rows[0].n).toBe(11);
  });

  it("are readable by signed-in users only and not writable by students", async () => {
    const { rows } = await as<{ n: number }>(db, amina, "select count(*)::int n from public.districts");
    expect(rows[0].n).toBeGreaterThan(100);
    await expectDenied(db, null, "select * from public.districts");
    await expectDenied(db, amina, "insert into public.districts (province_id, name) values ($1, 'Novo')", [gaza]);
  });

  it("must belong to the profile's province", async () => {
    await as(db, amina, "update public.profiles set province_id = $1, district_id = $2 where id = $3", [maputoCity, kaMpfumo, amina]);
    await expectDenied(
      db,
      amina,
      "update public.profiles set district_id = $1 where id = $2",
      [chokwe, amina],
      /does not belong/,
    );
    await expectDenied(
      db,
      amina,
      "update public.profiles set province_id = $1 where id = $2",
      [gaza, amina],
      /does not belong/,
    );
  });
});

describe("headline and summary", () => {
  it("students can set their own and the database enforces the limits", async () => {
    await as(db, amina, "update public.profiles set headline = 'Finalista de Contabilidade', summary = 'Procuro estágio.' where id = $1", [amina]);
    await expectDenied(db, amina, "update public.profiles set headline = $1 where id = $2", ["x".repeat(121), amina]);
    await expectDenied(db, amina, "update public.profiles set summary = $1 where id = $2", ["x".repeat(601), amina]);
  });

  it("a student cannot change another student's headline", async () => {
    const { rows } = await as(db, bento, "update public.profiles set headline = 'Hacked' where id = $1 returning id", [amina]);
    expect(rows).toHaveLength(0);
  });
});

describe("languages", () => {
  it("students manage their own languages with a level", async () => {
    const pt = (await db.query<{ id: number }>("select id from public.languages where code = 'pt'")).rows[0].id;
    await as(db, amina, "insert into public.student_languages (profile_id, language_id, level) values ($1, $2, 'native')", [amina, pt]);
    const { rows } = await as(db, amina, "select level from public.student_languages where profile_id = $1", [amina]);
    expect(rows).toEqual([{ level: "native" }]);
    await expectDenied(db, amina, "insert into public.student_languages (profile_id, language_id, level) values ($1, $2, 'fluent')", [amina, pt]);
  });

  it("are isolated between students and readable by administrators", async () => {
    const { rows } = await as(db, bento, "select * from public.student_languages where profile_id = $1", [amina]);
    expect(rows).toHaveLength(0);
    const en = (await db.query<{ id: number }>("select id from public.languages where code = 'en'")).rows[0].id;
    await expectDenied(db, bento, "insert into public.student_languages (profile_id, language_id, level) values ($1, $2, 'basic')", [amina, en]);
    const adminRows = await as(db, admin, "select * from public.student_languages where profile_id = $1", [amina]);
    expect(adminRows.rows).toHaveLength(1);
    await expectDenied(db, null, "select * from public.student_languages");
  });

  it("are blocked for suspended accounts", async () => {
    await as(db, admin, "select public.admin_set_account_status($1, 'suspended', 'Test')", [bento]);
    const en = (await db.query<{ id: number }>("select id from public.languages where code = 'en'")).rows[0].id;
    await expectDenied(db, bento, "insert into public.student_languages (profile_id, language_id, level) values ($1, $2, 'basic')", [bento, en]);
    await as(db, admin, "select public.admin_set_account_status($1, 'active', 'Test')", [bento]);
  });
});

describe("profile completion", () => {
  it("counts a district as location and keeps the existing scoring", async () => {
    await as(db, bento, "update public.profiles set city = null, headline = null where id = $1", [bento]);
    let c = (await as<{ c: { sections: { personal: { missing: string[] } } } }>(db, bento, "select public.profile_completion() as c")).rows[0].c;
    expect(c.sections.personal.missing).toContain("city");
    // The headline is required by the application, not scored (backward compatibility).
    expect(c.sections.personal.missing).not.toContain("headline");

    const district = (await db.query<{ id: number }>("select id from public.districts where name = 'KaTembe'")).rows[0].id;
    await as(db, bento, "update public.profiles set province_id = $1, district_id = $2 where id = $3", [maputoCity, district, bento]);
    c = (await as<{ c: { sections: { personal: { missing: string[] } } } }>(db, bento, "select public.profile_completion() as c")).rows[0].c;
    expect(c.sections.personal.missing).not.toContain("city");
  });
});

describe("public profile", () => {
  it("is off by default and cannot be switched on directly", async () => {
    const { rows } = await db.query<{ public_profile_enabled: boolean; public_slug: string | null }>(
      "select public_profile_enabled, public_slug from public.profiles where id = $1",
      [amina],
    );
    expect(rows[0]).toEqual({ public_profile_enabled: false, public_slug: null });
    await expectDenied(db, amina, "update public.profiles set public_profile_enabled = true where id = $1", [amina]);
    await expectDenied(db, amina, "update public.profiles set public_slug = 'amina' where id = $1", [amina]);
  });

  it("is not visible until enabled", async () => {
    await as(db, amina, "select public.set_public_profile(false, 'amina-macuacua', array['headline'])");
    const { rows } = await as<{ p: unknown }>(db, null, "select public.public_profile('amina-macuacua') as p");
    expect(rows[0].p).toBeNull();
  });

  it("needs an address to be enabled and rejects reserved or invalid addresses", async () => {
    await expectDenied(db, amina, "select public.set_public_profile(true, null, array['headline'])", [], /Choose a profile address/);
    await expectDenied(db, amina, "select public.set_public_profile(true, 'admin', '{}')", [], /not available/);
    await expectDenied(db, amina, "select public.set_public_profile(true, 'Amina Macuácua', '{}')", [], /not available/);
    await expectDenied(db, amina, "select public.set_public_profile(true, 'ab', '{}')", [], /not available/);
  });

  it("shows only the chosen sections, never contact details, and records consent", async () => {
    await as(db, amina, "update public.profiles set phone = '+258841234567' where id = $1", [amina]);
    await as(db, amina, "select public.set_public_profile(true, 'Amina-Macuacua', array['headline', 'languages', 'bogus'])");

    const { rows } = await as<{ p: Record<string, unknown> }>(db, null, "select public.public_profile('amina-macuacua') as p");
    const p = rows[0].p;
    expect(p.first_name).toBe("Amina");
    expect(p.headline).toBe("Finalista de Contabilidade");
    expect(p.sections).toEqual(["headline", "languages"]);
    expect(p.languages).toEqual([{ name_en: "Portuguese", name_pt: "Português", level: "native" }]);
    expect(p).not.toHaveProperty("summary");
    expect(p).not.toHaveProperty("location");
    expect(JSON.stringify(p)).not.toContain("+258");
    expect(JSON.stringify(p)).not.toContain("amina@example.com");

    const consent = await db.query<{ granted: boolean }>(
      "select granted from public.consent_records where user_id = $1 and consent_type = 'public_profile' order by created_at",
      [amina],
    );
    expect(consent.rows).toEqual([{ granted: true }]);
  });

  it("does not record consent again when only the sections change", async () => {
    await as(db, amina, "select public.set_public_profile(true, 'amina-macuacua', array['headline', 'summary', 'location'])");
    const consent = await db.query("select 1 from public.consent_records where user_id = $1 and consent_type = 'public_profile'", [amina]);
    expect(consent.rows).toHaveLength(1);
    const p = (await as<{ p: Record<string, unknown> }>(db, null, "select public.public_profile('amina-macuacua') as p")).rows[0].p;
    expect(p.summary).toBe("Procuro estágio.");
    expect(p.location).toMatchObject({ province_pt: "Cidade de Maputo", district: "KaMpfumo" });
  });

  it("addresses are unique", async () => {
    await expectDenied(db, bento, "select public.set_public_profile(true, 'amina-macuacua', '{}')", [], /already taken/);
  });

  it("is hidden while the account is suspended and after it is switched off", async () => {
    await as(db, admin, "select public.admin_set_account_status($1, 'suspended', 'Test')", [amina]);
    let p = (await as<{ p: unknown }>(db, null, "select public.public_profile('amina-macuacua') as p")).rows[0].p;
    expect(p).toBeNull();
    await expectDenied(db, amina, "select public.set_public_profile(true, 'amina-macuacua', '{}')", [], /suspended/);
    await as(db, admin, "select public.admin_set_account_status($1, 'active', 'Test')", [amina]);

    await as(db, amina, "select public.set_public_profile(false, 'amina-macuacua', array['headline'])");
    p = (await as<{ p: unknown }>(db, null, "select public.public_profile('amina-macuacua') as p")).rows[0].p;
    expect(p).toBeNull();
    const consent = await db.query<{ granted: boolean }>(
      "select granted from public.consent_records where user_id = $1 and consent_type = 'public_profile' order by created_at",
      [amina],
    );
    expect(consent.rows.map((r) => r.granted)).toEqual([true, false]);
  });

  it("functions follow the hardening pattern", async () => {
    const { rows } = await db.query<{ proname: string; proconfig: string[] }>(
      "select proname, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1)",
      [["set_public_profile", "public_profile"]],
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.proconfig).toContain("search_path=\"\"");
    const anon = await db.query<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1) and has_function_privilege('anon', oid, 'execute') order by 1",
      [["set_public_profile", "public_profile"]],
    );
    expect(anon.rows.map((r) => r.proname)).toEqual(["public_profile"]);
  });
});

describe("upgrading a database that already holds data", () => {
  it("keeps existing profiles' language and makes everything private", async () => {
    const old = await createDb({ upTo: "20261115000400" });
    const s = await signUp(old, { email: "existing@example.com", meta: { first_name: "Eva", surname: "Mondlane" } });
    await applyMigrations(old, { after: "20261115000400" });
    const { rows } = await old.query<{ preferred_locale: string; public_profile_enabled: boolean; public_sections: string[] }>(
      "select preferred_locale, public_profile_enabled, public_sections from public.profiles where id = $1",
      [s],
    );
    expect(rows[0]).toEqual({ preferred_locale: "en", public_profile_enabled: false, public_sections: [] });
    await old.close();
  }, 60_000);
});

describe("public profile photo", () => {
  it("is readable by anyone only while the public profile shows it", async () => {
    const carla = await signUp(db, { email: "carla@example.com", meta: { first_name: "Carla", surname: "Nhantumbo" } });
    const photo = `${carla}/photo.jpg`;
    const other = `${carla}/cv.pdf`;
    await as(db, carla, "insert into storage.objects (bucket_id, name) values ('avatars', $1), ('documents', $2)", [photo, other]);
    await as(db, carla, "update public.profiles set photo_path = $1 where id = $2", [photo, carla]);

    const visible = async () =>
      (await as<{ name: string }>(db, null, "select name from storage.objects order by name")).rows.map((r) => r.name);

    expect(await visible()).toEqual([]);
    await as(db, carla, "select public.set_public_profile(true, 'carla-n', array['headline'])");
    expect(await visible()).toEqual([]);
    await as(db, carla, "select public.set_public_profile(true, 'carla-n', array['headline', 'photo'])");
    expect(await visible()).toEqual([photo]);

    await as(db, admin, "select public.admin_set_account_status($1, 'suspended', 'Test')", [carla]);
    expect(await visible()).toEqual([]);
    await as(db, admin, "select public.admin_set_account_status($1, 'active', 'Test')", [carla]);

    await as(db, carla, "select public.set_public_profile(false, 'carla-n', array['photo'])");
    expect(await visible()).toEqual([]);
  });
});
