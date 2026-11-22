-- Handson · Learning · Results for administrators
--
--   1. quiz_attempts: every quiz attempt with the answers given (per question,
--      right or wrong). Written only by submit_quiz().
--   2. submit_quiz(): same signature and behaviour; now also records the attempt.
--   3. admin_learning_overview(): per course, students started / completed.
--   4. admin_course_results(course): per lesson, started / completed; per quiz,
--      attempts, average score, pass rate and how often each question is missed.
--
-- Results are aggregated: no student is named. Readable by any administrator
-- role (reviewer and above).
--
-- Requires 20261123000200_lms_pilot_course.sql.

-- ===========================================================================
-- 1. Quiz attempts
-- ===========================================================================
create table public.quiz_attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  lesson_id   uuid not null references public.course_lessons (id) on delete cascade,
  answers     smallint[] not null,
  correct     boolean[] not null,
  score       smallint not null check (score between 0 and 100),
  passed      boolean not null,
  created_at  timestamptz not null default now(),
  check (array_length(answers, 1) = array_length(correct, 1))
);
create index quiz_attempts_lesson_idx on public.quiz_attempts (lesson_id, created_at);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

comment on table public.quiz_attempts is
  'One row per quiz attempt. answers[i] / correct[i] follow question position order. Written only by submit_quiz().';

alter table public.quiz_attempts enable row level security;
create policy "Students can read own quiz attempts" on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins can read quiz attempts" on public.quiz_attempts
  for select to authenticated using (public.is_admin());
revoke all on public.quiz_attempts from anon, authenticated;
grant select on public.quiz_attempts to authenticated;

-- ===========================================================================
-- 2. submit_quiz(): unchanged contract, now records each attempt
-- ===========================================================================
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
  v_correct boolean[];
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
                                      'correct_index', q.correct_index, 'explanation', q.explanation) order by q.rn),
         array_agg(coalesce(p_answers[q.rn] = q.correct_index, false) order by q.rn)
    into v_right, v_detail, v_correct
  from (select qq.*, row_number() over (order by qq.position)::int rn from public.quiz_questions qq where qq.lesson_id = p_lesson) q;

  v_score := round(100.0 * v_right / v_total);
  select pass_mark into v_pass from public.courses where id = v_course;
  v_passed := v_score >= v_pass;

  insert into public.quiz_attempts (user_id, lesson_id, answers, correct, score, passed)
  values (uid, p_lesson, p_answers, v_correct, v_score, v_passed);

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

-- ===========================================================================
-- 3. Overview per course (administrators)
-- ===========================================================================
create or replace function public.admin_learning_overview()
returns table (
  course_id uuid, slug text, title text, status public.course_status, audience public.course_audience,
  price_mzn integer, lessons integer, started integer, completed integer, with_access integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
  select c.id, c.slug, c.title, c.status, c.audience, c.price_mzn,
         (select count(*)::int from public.course_modules m join public.course_lessons l on l.module_id = m.id where m.course_id = c.id),
         (select count(distinct lp.user_id)::int from public.course_modules m join public.course_lessons l on l.module_id = m.id
            join public.lesson_progress lp on lp.lesson_id = l.id where m.course_id = c.id),
         (select count(*)::int from public.course_completions cc where cc.course_id = c.id),
         (select count(*)::int from public.course_access ca where ca.course_id = c.id and ca.revoked_at is null)
  from public.courses c
  order by c.sort_order, c.title;
end;
$$;

-- ===========================================================================
-- 4. Results of one course (administrators)
-- ===========================================================================
create or replace function public.admin_course_results(p_course uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.courses%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into c from public.courses where id = p_course;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'pass_mark', c.pass_mark,
    'started', (select count(distinct lp.user_id) from public.course_modules m join public.course_lessons l on l.module_id = m.id
                  join public.lesson_progress lp on lp.lesson_id = l.id where m.course_id = c.id),
    'completed', (select count(*) from public.course_completions cc where cc.course_id = c.id),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'module', m.position, 'position', l.position, 'title', l.title, 'type', l.lesson_type,
               'started', (select count(*) from public.lesson_progress lp where lp.lesson_id = l.id),
               'completed', (select count(*) from public.lesson_progress lp where lp.lesson_id = l.id and lp.completed_at is not null),
               'quiz', case when l.lesson_type = 'quiz' then (
                 select jsonb_build_object(
                   'attempts', count(*),
                   'students', count(distinct qa.user_id),
                   'average_score', round(avg(qa.score)),
                   'first_attempt_pass_rate', (
                     select round(100.0 * count(*) filter (where f.passed) / nullif(count(*), 0))
                     from (select distinct on (x.user_id) x.passed from public.quiz_attempts x
                           where x.lesson_id = l.id order by x.user_id, x.created_at) f),
                   'questions', coalesce((
                     select jsonb_agg(jsonb_build_object(
                              'position', q.position, 'prompt', q.prompt,
                              'missed_pct', (select round(100.0 * count(*) filter (where not a.correct[q.rn]) / nullif(count(*), 0))
                                             from public.quiz_attempts a where a.lesson_id = l.id))
                            order by q.position)
                     from (select qq.*, row_number() over (order by qq.position)::int rn
                           from public.quiz_questions qq where qq.lesson_id = l.id) q), '[]'::jsonb))
                 from public.quiz_attempts qa where qa.lesson_id = l.id)
               end)
             order by m.position, l.position)
      from public.course_modules m join public.course_lessons l on l.module_id = m.id
      where m.course_id = c.id), '[]'::jsonb)
  );
end;
$$;

-- ===========================================================================
-- 5. Execute grants
-- ===========================================================================
revoke execute on function public.submit_quiz(uuid, smallint[]) from public, anon, authenticated;
grant execute on function public.submit_quiz(uuid, smallint[]) to authenticated;
revoke execute on function public.admin_learning_overview() from public, anon, authenticated;
grant execute on function public.admin_learning_overview() to authenticated;
revoke execute on function public.admin_course_results(uuid) from public, anon, authenticated;
grant execute on function public.admin_course_results(uuid) to authenticated;
