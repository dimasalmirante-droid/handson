-- Handson · read-only schema catalogue
--
-- Produces one sorted line per database object that the repository
-- migrations create or change: tables, columns, constraints, indexes, Row
-- Level Security, policies, functions (signature, security, search_path,
-- body fingerprint, who may execute), triggers, enum types, grants, storage
-- buckets and storage policies. Used to compare a database with a reference
-- built from the migration files. Lines starting with "data|" describe
-- reference data (catalogue contents), which administrators may edit; they
-- are reported but are not part of the schema comparison.
--
-- Runs entirely in a read-only transaction and changes nothing.

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
set default_transaction_read_only = on;
begin transaction read only;

with lines(line) as (
  -- Extensions the migrations rely on (schema only; versions are managed by Supabase)
  select 'extension|' || e.extname || '|' || n.nspname
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname in ('citext', 'pg_trgm', 'pgcrypto')

  union all
  -- Tables, views and their Row Level Security switches
  select 'relation|' || c.relname || '|' || c.relkind::text || '|rls=' || c.relrowsecurity || '|force=' || c.relforcerowsecurity
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')

  union all
  -- Columns
  select 'column|' || c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod)
         || '|notnull=' || a.attnotnull
         || '|default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
         || '|identity=' || a.attidentity::text || '|generated=' || a.attgenerated::text
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
    and a.attnum > 0 and not a.attisdropped

  union all
  -- Constraints (primary, foreign, unique, check, exclusion)
  select 'constraint|' || c.relname || '|' || con.conname || '|' || con.contype::text || '|' || pg_get_constraintdef(con.oid, true)
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  where c.relnamespace = 'public'::regnamespace

  union all
  -- Indexes
  select 'index|' || i.tablename || '|' || i.indexname || '|' || i.indexdef
  from pg_indexes i
  where i.schemaname = 'public'

  union all
  -- Policies in public and on storage.objects
  select 'policy|' || p.schemaname || '.' || p.tablename || '|' || p.policyname || '|' || p.permissive || '|' || p.cmd
         || '|roles=' || array_to_string(array(select unnest(p.roles) order by 1), ',')
         || '|using=' || coalesce(p.qual, '') || '|check=' || coalesce(p.with_check, '')
  from pg_policies p
  where p.schemaname = 'public' or (p.schemaname = 'storage' and p.tablename = 'objects')

  union all
  -- Functions: signature, result, security, volatility, settings and a fingerprint of the body
  select 'function|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || '|returns=' || pg_get_function_result(p.oid)
         || '|definer=' || p.prosecdef || '|volatile=' || p.provolatile::text
         || '|config=' || coalesce(array_to_string(p.proconfig, ','), '')
         -- Line endings are normalised (CRLF/CR → LF): SQL pasted from Windows
         -- stores CRLF bodies that are otherwise identical.
         || '|body=' || md5(replace(replace(p.prosrc, E'\r\n', E'\n'), E'\r', E'\n'))
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

  union all
  -- Who may execute each function
  select 'execute|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || '|anon=' || has_function_privilege('anon', p.oid, 'execute')
         || '|authenticated=' || has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

  union all
  -- Table privileges for client roles
  select 'grant|' || c.relname || '|' || r.rolname
         || '|select=' || has_table_privilege(r.rolname, c.oid, 'select')
         || '|insert=' || has_table_privilege(r.rolname, c.oid, 'insert')
         || '|update=' || has_table_privilege(r.rolname, c.oid, 'update')
         || '|delete=' || has_table_privilege(r.rolname, c.oid, 'delete')
  from pg_class c cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) r
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')

  union all
  -- Column-level privileges for client roles
  select 'column_grant|' || cp.table_name || '.' || cp.column_name || '|' || cp.grantee || '|' || cp.privilege_type
  from information_schema.column_privileges cp
  where cp.table_schema = 'public' and cp.grantee in ('anon', 'authenticated')
    and not exists (
      select 1 from information_schema.table_privileges tp
      where tp.table_schema = cp.table_schema and tp.table_name = cp.table_name
        and tp.grantee = cp.grantee and tp.privilege_type = cp.privilege_type)

  union all
  -- Triggers on public tables and on auth.users
  select 'trigger|' || n.nspname || '.' || c.relname || '|' || t.tgname || '|enabled=' || t.tgenabled::text || '|' || pg_get_triggerdef(t.oid, true)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
    and (n.nspname = 'public' or t.tgname like 'on\_auth\_user%')

  union all
  -- Enum types and their values in order
  select 'enum|' || t.typname || '|' || string_agg(e.enumlabel, ',' order by e.enumsortorder)
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  where t.typnamespace = 'public'::regnamespace
  group by t.typname

  union all
  -- Storage buckets
  select 'bucket|' || b.id || '|public=' || coalesce(b.public, false) || '|limit=' || coalesce(b.file_size_limit::text, '')
         || '|types=' || coalesce(array_to_string(array(select unnest(b.allowed_mime_types) order by 1), ','), '')
  from storage.buckets b
)
select line from lines order by line collate "C";

-- Reference data (reported, not compared). Only once the catalogue tables exist.
select to_regclass('public.provinces') is not null as has_catalogues \gset
\if :has_catalogues
select 'data|' || x.t || '|rows=' || x.n || '|fingerprint=' || x.f
from (
  select 'provinces' t, count(*) n, md5(string_agg(code, ',' order by code)) f from public.provinces
  union all select 'institutions', count(*), md5(string_agg(name, ',' order by name)) from public.institutions
  union all select 'qualification_types', count(*), md5(string_agg(code, ',' order by code)) from public.qualification_types
  union all select 'fields_of_study', count(*), md5(string_agg(code, ',' order by code)) from public.fields_of_study
  union all select 'skill_categories', count(*), md5(string_agg(code, ',' order by code)) from public.skill_categories
  union all select 'skill_catalogue', count(*), md5(string_agg(name_en, ',' order by name_en)) from public.skill_catalogue
  union all select 'industries', count(*), md5(string_agg(code, ',' order by code)) from public.industries
  union all select 'job_functions', count(*), md5(string_agg(code, ',' order by code)) from public.job_functions
) x
order by 1;
\endif

rollback;
