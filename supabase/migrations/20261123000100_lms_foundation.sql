-- Handson · Learning (LMS) foundation · Database
--
-- A catalogue of courses for students:
--   1. Categories and courses (draft / published / archived, free or priced in MZN,
--      open to all students or restricted, optional order and prerequisites).
--   2. Modules, lessons (video, text, quiz, file, link) and quiz questions.
--   3. Access: how a student got into a course (free, purchase, sponsor, voucher,
--      admin grant). Lessons check access, never the price.
--   4. Progress per lesson and course completions (the completion is the badge).
--   5. Student functions: catalogue, course outline, start, complete a lesson,
--      take a quiz (graded on the server), redeem a voucher.
--   6. Administrator functions: grant and revoke access (audited).
--
-- Students never write these tables directly; every student change goes
-- through a security-definer function. Correct quiz answers are never
-- readable by students. Payments are not part of this migration: a paid
-- course is opened by an administrator grant until a payment provider exists.
--
-- Additive only. Requires 20261120000100_procurement_portuguese.sql.

-- ===========================================================================
-- 0. Types
-- ===========================================================================
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.course_audience as enum ('all_students', 'restricted');
create type public.lesson_type as enum ('video', 'text', 'quiz', 'file', 'link');
create type public.course_access_source as enum ('free', 'purchase', 'sponsor', 'voucher', 'admin_grant');

-- ===========================================================================
-- 1. Categories and courses
-- ===========================================================================
create table public.course_categories (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name        text not null check (char_length(name) between 2 and 100),
  name_pt     text not null check (char_length(name_pt) between 2 and 100),
  sort_order  smallint not null default 0
);

insert into public.course_categories (slug, name, name_pt, sort_order) values
  ('work-readiness', 'Work readiness', 'Preparação para o trabalho', 1),
  ('digital-skills', 'Digital skills', 'Competências digitais', 2),
  ('sector-skills', 'Sector skills', 'Competências por sector', 3);

create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  category_id   smallint references public.course_categories (id) on delete set null,
  title         text not null check (char_length(title) between 3 and 150),
  summary       text check (char_length(summary) <= 1000),
  status        public.course_status not null default 'draft',
  audience      public.course_audience not null default 'all_students',
  sequential    boolean not null default false,
  pass_mark     smallint not null default 75 check (pass_mark between 1 and 100),
  badge_name    text check (char_length(badge_name) between 3 and 100),
  price_mzn     integer not null default 0 check (price_mzn between 0 and 10000000),
  version       integer not null default 1 check (version >= 1),
  sort_order    smallint not null default 0,
  published_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint courses_published_at check (status = 'draft' or published_at is not null)
);
create index courses_catalogue_idx on public.courses (status, sort_order);
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

comment on column public.courses.price_mzn is '0 = free. Lessons are opened by course_access (or free + all_students), never by the price alone.';
comment on column public.courses.version is 'Raised by administrators when content changes; completions record the version completed.';
comment on column public.courses.sequential is 'True: a module opens only when the previous modules are complete.';

create table public.course_prerequisites (
  course_id           uuid not null references public.courses (id) on delete cascade,
  requires_course_id  uuid not null references public.courses (id) on delete cascade,
  primary key (course_id, requires_course_id),
  check (course_id <> requires_course_id)
);

-- ===========================================================================
-- 2. Modules, lessons, quiz questions
-- ===========================================================================
create table public.course_modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  position   smallint not null check (position >= 1),
  title      text not null check (char_length(title) between 2 and 150),
  objective  text check (char_length(objective) <= 1000),
  unique (course_id, position)
);

create table public.course_lessons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.course_modules (id) on delete cascade,
  position          smallint not null check (position >= 1),
  title             text not null check (char_length(title) between 2 and 150),
  lesson_type       public.lesson_type not null,
  video_url         text check (video_url ~ '^https://(www\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)/'),
  body              text check (char_length(body) <= 20000),
  file_path         text check (char_length(file_path) <= 500),
  link_url          text check (link_url ~ '^https://' and char_length(link_url) <= 500),
  duration_minutes  smallint check (duration_minutes between 1 and 600),
  is_preview        boolean not null default false,
  unique (module_id, position),
  constraint course_lessons_content check (
    (lesson_type <> 'video' or video_url is not null)
    and (lesson_type <> 'text' or body is not null)
    and (lesson_type <> 'file' or file_path is not null)
    and (lesson_type <> 'link' or link_url is not null)
  )
);
comment on column public.course_lessons.body is 'Markdown. For a video lesson: the written summary under the video.';
comment on column public.course_lessons.is_preview is 'Open to every student who can see the course, even without access (e.g. first lesson of a paid course).';

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references public.course_lessons (id) on delete cascade,
  position       smallint not null check (position >= 1),
  prompt         text not null check (char_length(prompt) between 3 and 1000),
  options        text[] not null check (array_length(options, 1) between 2 and 6),
  correct_index  smallint not null check (correct_index >= 0),
  explanation    text check (char_length(explanation) <= 1000),
  unique (lesson_id, position),
  constraint quiz_questions_correct_in_range check (correct_index < array_length(options, 1))
);
comment on column public.quiz_questions.correct_index is 'Zero-based. Never readable by students: grading happens in submit_quiz().';

-- ===========================================================================
-- 3. Access and vouchers
-- ===========================================================================
create table public.course_access (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  source          public.course_access_source not null,
  course_version  integer not null,
  amount_mzn      integer not null default 0 check (amount_mzn >= 0),
  sponsor_name    text check (char_length(sponsor_name) <= 150),
  voucher_id      uuid,
  note            text check (char_length(note) <= 500),
  granted_by      uuid references auth.users (id) on delete set null,
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users (id) on delete set null
);
create unique index course_access_active_key on public.course_access (user_id, course_id) where revoked_at is null;
create index course_access_course_idx on public.course_access (course_id);
comment on table public.course_access is 'How each student got into a course. Written only by server-side functions.';

create table public.course_vouchers (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  code        text not null unique check (code ~ '^[A-Z0-9-]{4,40}$'),
  max_uses    integer check (max_uses >= 1),
  used_count  integer not null default 0 check (used_count >= 0),
  expires_at  timestamptz,
  sponsor_name text check (char_length(sponsor_name) <= 150),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (max_uses is null or used_count <= max_uses)
);
comment on table public.course_vouchers is 'Codes that open a course at no cost to the student (full access only; partial discounts come with payments).';

alter table public.course_access
  add constraint course_access_voucher_fk foreign key (voucher_id) references public.course_vouchers (id) on delete set null;

-- ===========================================================================
-- 4. Progress and completions
-- ===========================================================================
create table public.lesson_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  lesson_id     uuid not null references public.course_lessons (id) on delete cascade,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  best_score    smallint check (best_score between 0 and 100),
  attempts      integer not null default 0 check (attempts >= 0),
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

create table public.course_completions (
  user_id         uuid not null references auth.users (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  course_version  integer not null,
  completed_at    timestamptz not null default now(),
  primary key (user_id, course_id)
);
comment on table public.course_completions is 'One row per completed course: the badge. Kept when course content changes; records the version completed.';

-- ===========================================================================
-- 5. Access helpers
-- ===========================================================================
-- Signed-in student with an active account and a student profile.
create or replace function public.lms_learner_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.accounts a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and a.status = 'active'
  );
$$;

-- Active access record for the current user.
create or replace function public.lms_has_grant(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_access ca
    where ca.course_id = p_course
      and ca.user_id = (select auth.uid())
      and ca.revoked_at is null
      and (ca.expires_at is null or ca.expires_at > now())
  );
$$;

-- The course appears in the current user's catalogue.
create or replace function public.lms_course_visible(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.lms_learner_is_active() and exists (
    select 1 from public.courses c
    where c.id = p_course
      and c.status = 'published'
      and (c.audience = 'all_students' or public.lms_has_grant(c.id))
  );
$$;

-- The current user may open the course's lessons: visible, free-for-all or
-- granted, and every prerequisite completed.
create or replace function public.lms_can_enter(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.lms_course_visible(p_course)
    and exists (
      select 1 from public.courses c
      where c.id = p_course
        and ((c.price_mzn = 0 and c.audience = 'all_students') or public.lms_has_grant(c.id))
    )
    and not exists (
      select 1 from public.course_prerequisites cp
      where cp.course_id = p_course
        and not exists (
          select 1 from public.course_completions cc
          where cc.course_id = cp.requires_course_id and cc.user_id = (select auth.uid())
        )
    );
$$;

-- The current user may read this lesson's content.
create or replace function public.lms_can_read_lesson(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = p_lesson
      and (public.lms_can_enter(m.course_id) or (l.is_preview and public.lms_course_visible(m.course_id)))
  );
$$;

-- In a sequential course, a module is open when every lesson of earlier modules is complete.
create or replace function public.lms_module_open(p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not c.sequential or not exists (
    select 1
    from public.course_modules earlier
    join public.course_lessons l on l.module_id = earlier.id
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = (select auth.uid())
    where earlier.course_id = m.course_id
      and earlier.position < m.position
      and lp.completed_at is null
  )
  from public.course_modules m
  join public.courses c on c.id = m.course_id
  where m.id = p_module;
$$;

-- ===========================================================================
-- 6. Row Level Security
-- ===========================================================================
alter table public.course_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.course_access enable row level security;
alter table public.course_vouchers enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.course_completions enable row level security;

-- Content: students read what they may see; admins manage everything.
create policy "Signed-in users can read course categories" on public.course_categories
  for select to authenticated using (true);
create policy "Admins can manage course categories" on public.course_categories
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

create policy "Students can read visible courses" on public.courses
  for select to authenticated using (public.lms_course_visible(id));
create policy "Admins can read courses" on public.courses
  for select to authenticated using (public.is_admin());
create policy "Admins can manage courses" on public.courses
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

create policy "Students can read prerequisites of visible courses" on public.course_prerequisites
  for select to authenticated using (public.lms_course_visible(course_id));
create policy "Admins can manage prerequisites" on public.course_prerequisites
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

create policy "Students can read modules of visible courses" on public.course_modules
  for select to authenticated using (public.lms_course_visible(course_id));
create policy "Admins can manage modules" on public.course_modules
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

create policy "Students can read lessons they may open" on public.course_lessons
  for select to authenticated using (public.lms_can_read_lesson(id));
create policy "Admins can manage lessons" on public.course_lessons
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

-- Quiz questions: students never read this table (no grant on correct_index);
-- they get questions through quiz_for_lesson(). Admins manage it.
create policy "Admins can manage quiz questions" on public.quiz_questions
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

-- Access, progress, completions: students read their own; admins read all.
-- No client writes: changes go through the functions below.
create policy "Students can read own course access" on public.course_access
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins can read course access" on public.course_access
  for select to authenticated using (public.is_admin());

create policy "Admins can manage vouchers" on public.course_vouchers
  for all to authenticated using (public.has_admin_role('admin')) with check (public.has_admin_role('admin'));

create policy "Students can read own lesson progress" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins can read lesson progress" on public.lesson_progress
  for select to authenticated using (public.is_admin());

create policy "Students can read own completions" on public.course_completions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins can read completions" on public.course_completions
  for select to authenticated using (public.is_admin());

revoke all on public.course_categories, public.courses, public.course_prerequisites, public.course_modules,
  public.course_lessons, public.quiz_questions, public.course_access, public.course_vouchers,
  public.lesson_progress, public.course_completions from anon, authenticated;

grant select, insert, update, delete on public.course_categories, public.courses, public.course_prerequisites,
  public.course_modules, public.course_lessons, public.quiz_questions, public.course_vouchers to authenticated;
grant select on public.course_access, public.lesson_progress, public.course_completions to authenticated;

-- ===========================================================================
-- 7. Student functions
-- ===========================================================================

-- Internal: record the course completion once every lesson is complete.
create or replace function public.lms_check_completion(p_user uuid, p_course uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if exists (
    select 1
    from public.course_modules m
    join public.course_lessons l on l.module_id = m.id
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_user
    where m.course_id = p_course and lp.completed_at is null
  ) then
    return false;
  end if;
  if not exists (select 1 from public.course_modules m join public.course_lessons l on l.module_id = m.id where m.course_id = p_course) then
    return false;
  end if;
  select version into v_version from public.courses where id = p_course;
  insert into public.course_completions (user_id, course_id, course_version)
  values (p_user, p_course, v_version)
  on conflict (user_id, course_id) do nothing;
  return true;
end;
$$;

-- Catalogue for the current student: visible courses with price, access and progress.
create or replace function public.course_catalogue()
returns table (
  id uuid, slug text, title text, summary text, category_slug text, category_name text, category_name_pt text,
  price_mzn integer, badge_name text, sequential boolean, can_enter boolean, has_access boolean,
  lessons_total integer, lessons_completed integer, completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.title, c.summary, cat.slug, cat.name, cat.name_pt,
         c.price_mzn, c.badge_name, c.sequential,
         public.lms_can_enter(c.id),
         public.lms_has_grant(c.id) or (c.price_mzn = 0 and c.audience = 'all_students'),
         (select count(*)::int from public.course_modules m join public.course_lessons l on l.module_id = m.id where m.course_id = c.id),
         (select count(*)::int from public.course_modules m join public.course_lessons l on l.module_id = m.id
            join public.lesson_progress lp on lp.lesson_id = l.id
           where m.course_id = c.id and lp.user_id = (select auth.uid()) and lp.completed_at is not null),
         (select cc.completed_at from public.course_completions cc where cc.course_id = c.id and cc.user_id = (select auth.uid()))
  from public.courses c
  left join public.course_categories cat on cat.id = c.category_id
  where public.lms_course_visible(c.id)
  order by c.sort_order, c.title;
$$;

-- Outline of one course: modules and lesson titles with lock and progress state.
-- Lesson content is not included; read it from course_lessons (RLS decides).
create or replace function public.course_outline(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.courses%rowtype;
  uid uuid := (select auth.uid());
  v_enter boolean;
begin
  select * into c from public.courses where slug = lower(trim(p_slug));
  if not found or not public.lms_course_visible(c.id) then
    return null;
  end if;
  v_enter := public.lms_can_enter(c.id);
  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'summary', c.summary, 'price_mzn', c.price_mzn,
    'badge_name', c.badge_name, 'sequential', c.sequential, 'pass_mark', c.pass_mark, 'can_enter', v_enter,
    'prerequisites', coalesce((
      select jsonb_agg(jsonb_build_object('slug', r.slug, 'title', r.title,
               'completed', exists (select 1 from public.course_completions cc where cc.course_id = r.id and cc.user_id = uid)))
      from public.course_prerequisites cp join public.courses r on r.id = cp.requires_course_id
      where cp.course_id = c.id), '[]'::jsonb),
    'completed_at', (select cc.completed_at from public.course_completions cc where cc.course_id = c.id and cc.user_id = uid),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'position', m.position, 'title', m.title, 'objective', m.objective,
               'open', v_enter and public.lms_module_open(m.id),
               'lessons', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', l.id, 'position', l.position, 'title', l.title, 'type', l.lesson_type,
                          'duration_minutes', l.duration_minutes, 'is_preview', l.is_preview,
                          'completed', lp.completed_at is not null, 'best_score', lp.best_score)
                        order by l.position)
                 from public.course_lessons l
                 left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = uid
                 where l.module_id = m.id), '[]'::jsonb))
             order by m.position)
      from public.course_modules m where m.course_id = c.id), '[]'::jsonb)
  );
end;
$$;

-- Quiz questions for a lesson the student may open, without the answers.
create or replace function public.quiz_for_lesson(p_lesson uuid)
returns table (id uuid, question_position smallint, prompt text, options text[])
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.position, q.prompt, q.options
  from public.quiz_questions q
  where q.lesson_id = p_lesson
    and public.lms_can_read_lesson(p_lesson)
  order by q.position;
$$;

-- Shared checks before a student records progress on a lesson.
create or replace function public.lms_assert_can_progress(p_lesson uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_module uuid;
  v_course uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select l.module_id, m.course_id into v_module, v_course
  from public.course_lessons l join public.course_modules m on m.id = l.module_id
  where l.id = p_lesson;
  if not found then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;
  if not public.lms_can_enter(v_course) then
    raise exception 'No access to this course' using errcode = '42501';
  end if;
  if not public.lms_module_open(v_module) then
    raise exception 'Complete the previous modules first' using errcode = '42501';
  end if;
  return v_course;
end;
$$;

-- Mark a non-quiz lesson as complete. Returns true when the course became complete.
create or replace function public.complete_lesson(p_lesson uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_course uuid;
begin
  v_course := public.lms_assert_can_progress(p_lesson);
  if (select lesson_type from public.course_lessons where id = p_lesson) = 'quiz' then
    raise exception 'A quiz is completed by passing it' using errcode = '22023';
  end if;
  insert into public.lesson_progress (user_id, lesson_id, completed_at)
  values (uid, p_lesson, now())
  on conflict (user_id, lesson_id) do update set completed_at = coalesce(public.lesson_progress.completed_at, now());
  return public.lms_check_completion(uid, v_course);
end;
$$;

-- Grade a quiz on the server. p_answers[i] = zero-based option chosen for question i (by position).
-- Returns score (0-100), whether it passed, whether the course is now complete, and
-- per question whether it was right, the correct option and the explanation.
create or replace function public.submit_quiz(p_lesson uuid, p_answers smallint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_course uuid;
  v_total integer;
  v_right integer;
  v_score smallint;
  v_pass smallint;
  v_passed boolean;
  v_done boolean := false;
  v_detail jsonb;
begin
  v_course := public.lms_assert_can_progress(p_lesson);
  if (select lesson_type from public.course_lessons where id = p_lesson) <> 'quiz' then
    raise exception 'This lesson is not a quiz' using errcode = '22023';
  end if;
  select count(*) into v_total from public.quiz_questions where lesson_id = p_lesson;
  if v_total = 0 then
    raise exception 'This quiz has no questions yet' using errcode = 'P0002';
  end if;
  if p_answers is null or coalesce(array_length(p_answers, 1), 0) <> v_total then
    raise exception 'Answer every question' using errcode = '22023';
  end if;

  select count(*) filter (where p_answers[q.rn] = q.correct_index),
         jsonb_agg(jsonb_build_object('question_id', q.id, 'correct', p_answers[q.rn] = q.correct_index,
                                      'correct_index', q.correct_index, 'explanation', q.explanation) order by q.rn)
    into v_right, v_detail
  from (select qq.*, row_number() over (order by qq.position)::int rn from public.quiz_questions qq where qq.lesson_id = p_lesson) q;

  v_score := round(100.0 * v_right / v_total);
  select pass_mark into v_pass from public.courses where id = v_course;
  v_passed := v_score >= v_pass;

  insert into public.lesson_progress (user_id, lesson_id, attempts, best_score, completed_at)
  values (uid, p_lesson, 1, v_score, case when v_passed then now() end)
  on conflict (user_id, lesson_id) do update
    set attempts = public.lesson_progress.attempts + 1,
        best_score = greatest(coalesce(public.lesson_progress.best_score, 0), excluded.best_score),
        completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at);

  if v_passed then
    v_done := public.lms_check_completion(uid, v_course);
  end if;
  return jsonb_build_object('score', v_score, 'pass_mark', v_pass, 'passed', v_passed,
                            'course_completed', v_done, 'questions', v_detail);
end;
$$;

-- Redeem a voucher code: opens the course at no cost.
create or replace function public.redeem_course_voucher(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v public.course_vouchers%rowtype;
  v_course public.courses%rowtype;
begin
  if uid is null or not public.lms_learner_is_active() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v from public.course_vouchers where code = upper(trim(p_code)) for update;
  if not found or (v.expires_at is not null and v.expires_at <= now())
     or (v.max_uses is not null and v.used_count >= v.max_uses) then
    raise exception 'This code is not valid' using errcode = '22023';
  end if;
  select * into v_course from public.courses where id = v.course_id and status = 'published';
  if not found then
    raise exception 'This code is not valid' using errcode = '22023';
  end if;
  if exists (select 1 from public.course_access where user_id = uid and course_id = v.course_id and revoked_at is null) then
    return v.course_id;
  end if;
  insert into public.course_access (user_id, course_id, source, course_version, sponsor_name, voucher_id)
  values (uid, v.course_id, 'voucher', v_course.version, v.sponsor_name, v.id);
  update public.course_vouchers set used_count = used_count + 1 where id = v.id;
  return v.course_id;
end;
$$;

-- ===========================================================================
-- 8. Administrator functions (audited)
-- ===========================================================================
create or replace function public.admin_grant_course_access(
  p_user uuid,
  p_course uuid,
  p_source public.course_access_source,
  p_amount_mzn integer default 0,
  p_sponsor_name text default null,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if not public.has_admin_role('admin') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_source = 'voucher' then
    raise exception 'Vouchers are redeemed by students' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  select version into v_version from public.courses where id = p_course;
  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.course_access where user_id = p_user and course_id = p_course and revoked_at is null) then
    raise exception 'This student already has access' using errcode = '23505';
  end if;
  insert into public.course_access (user_id, course_id, source, course_version, amount_mzn, sponsor_name, note, granted_by, expires_at)
  values (p_user, p_course, p_source, v_version, greatest(coalesce(p_amount_mzn, 0), 0),
          nullif(trim(p_sponsor_name), ''), nullif(trim(p_note), ''), (select auth.uid()), p_expires_at)
  returning id into v_id;
  perform public.log_admin_action('course_access.grant', 'course_access', v_id::text,
    jsonb_build_object('user_id', p_user, 'course_id', p_course, 'source', p_source, 'amount_mzn', p_amount_mzn));
  return v_id;
end;
$$;

create or replace function public.admin_revoke_course_access(p_access uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role('admin') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update public.course_access
     set revoked_at = now(), revoked_by = (select auth.uid()),
         note = coalesce(nullif(trim(p_note), ''), note)
   where id = p_access and revoked_at is null;
  if not found then
    raise exception 'Access not found' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('course_access.revoke', 'course_access', p_access::text, '{}'::jsonb);
end;
$$;

-- ===========================================================================
-- 9. Execute grants
-- ===========================================================================
revoke execute on function public.lms_learner_is_active() from public, anon, authenticated;
revoke execute on function public.lms_has_grant(uuid) from public, anon, authenticated;
revoke execute on function public.lms_course_visible(uuid) from public, anon, authenticated;
revoke execute on function public.lms_can_enter(uuid) from public, anon, authenticated;
revoke execute on function public.lms_can_read_lesson(uuid) from public, anon, authenticated;
revoke execute on function public.lms_module_open(uuid) from public, anon, authenticated;
revoke execute on function public.lms_check_completion(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.lms_assert_can_progress(uuid) from public, anon, authenticated;
revoke execute on function public.course_catalogue() from public, anon, authenticated;
revoke execute on function public.course_outline(text) from public, anon, authenticated;
revoke execute on function public.quiz_for_lesson(uuid) from public, anon, authenticated;
revoke execute on function public.complete_lesson(uuid) from public, anon, authenticated;
revoke execute on function public.submit_quiz(uuid, smallint[]) from public, anon, authenticated;
revoke execute on function public.redeem_course_voucher(text) from public, anon, authenticated;
revoke execute on function public.admin_grant_course_access(uuid, uuid, public.course_access_source, integer, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_revoke_course_access(uuid, text) from public, anon, authenticated;

-- Helpers used inside RLS policies must be executable by signed-in users.
grant execute on function public.lms_learner_is_active() to authenticated;
grant execute on function public.lms_has_grant(uuid) to authenticated;
grant execute on function public.lms_course_visible(uuid) to authenticated;
grant execute on function public.lms_can_enter(uuid) to authenticated;
grant execute on function public.lms_can_read_lesson(uuid) to authenticated;
grant execute on function public.lms_module_open(uuid) to authenticated;

grant execute on function public.course_catalogue() to authenticated;
grant execute on function public.course_outline(text) to authenticated;
grant execute on function public.quiz_for_lesson(uuid) to authenticated;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.submit_quiz(uuid, smallint[]) to authenticated;
grant execute on function public.redeem_course_voucher(text) to authenticated;
grant execute on function public.admin_grant_course_access(uuid, uuid, public.course_access_source, integer, text, text, timestamptz) to authenticated;
grant execute on function public.admin_revoke_course_access(uuid, text) to authenticated;
