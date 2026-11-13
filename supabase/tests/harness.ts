/**
 * Shared set-up for the Module 2 database tests: an in-memory Postgres
 * (PGlite) with stand-ins for Supabase's auth schema, roles and storage, and
 * the repository migrations applied one file at a time, each in its own
 * transaction (as the migration workflow applies them).
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

export const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

/** The six migrations that make up the application currently in production. */
export const BASELINE_LAST = "20261109000600";

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email varchar(255),
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb,
    raw_app_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth, extensions to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid default auth.uid(),
    metadata jsonb,
    created_at timestamptz default now(),
    unique (bucket_id, name)
  );
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
}

/** Apply the migration files whose version (filename prefix) is within the range, each in one transaction. */
export async function applyMigrations(db: PGlite, opts: { after?: string; upTo?: string } = {}) {
  for (const file of migrationFiles()) {
    const version = file.slice(0, 14);
    if (opts.after && version <= opts.after) continue;
    if (opts.upTo && version > opts.upTo) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await db.exec(`begin;\n${sql}\ncommit;`).catch(async (e) => {
      await db.exec("rollback;").catch(() => undefined);
      throw new Error(`${file}: ${(e as Error).message}`);
    });
  }
}

export async function createDb(opts: { upTo?: string } = {}) {
  const db = new PGlite({ extensions: { citext, pg_trgm } });
  await db.exec(SUPABASE_STUBS);
  await applyMigrations(db, { upTo: opts.upTo });
  return db;
}

/** Run statements as a given user (or anonymous when uid is null). */
export async function as<T = Record<string, unknown>>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  await db.exec(`set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

export async function expectDenied(db: PGlite, uid: string | null, sql: string, params: unknown[] = [], message?: RegExp) {
  const p = as(db, uid, sql, params);
  await (message ? expect(p).rejects.toThrow(message) : expect(p).rejects.toThrow());
}

let seq = 0;
/** A fresh, unique user id. */
export function uid(): string {
  seq += 1;
  return `00000000-0000-4000-9000-${seq.toString(16).padStart(12, "0")}`;
}

type NewUser = {
  id?: string;
  email: string;
  confirmed?: boolean;
  meta?: Record<string, unknown>;
  provider?: "email" | "google";
};

/**
 * Create an auth user the way Supabase Auth does: email sign-ups carry the
 * registration form's metadata; Google sign-ups carry Google's profile data
 * and cannot carry custom metadata.
 */
export async function signUp(db: PGlite, u: NewUser): Promise<string> {
  const id = u.id ?? uid();
  const provider = u.provider ?? "email";
  const meta =
    u.meta ??
    (provider === "google"
      ? { full_name: "Google Person", given_name: "Google", family_name: "Person", email: u.email, email_verified: true }
      : {});
  await db.query(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
     values ($1, $2, case when $3 then now() end, $4, $5)`,
    [id, u.email, u.confirmed ?? true, JSON.stringify(meta), JSON.stringify({ provider, providers: [provider] })],
  );
  return id;
}

export async function makeAdmin(db: PGlite, id: string, role: "reviewer" | "admin" | "super_admin") {
  await db.query("insert into public.administrator_roles (user_id, role) values ($1, $2)", [id, role]);
}

/** A new invitation token and its SHA-256 hash, as the application creates them. */
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export async function hasProfile(db: PGlite, id: string) {
  const { rows } = await db.query("select 1 from public.profiles where id = $1", [id]);
  return rows.length === 1;
}

export async function hasAccount(db: PGlite, id: string) {
  const { rows } = await db.query("select 1 from public.accounts where user_id = $1", [id]);
  return rows.length === 1;
}
