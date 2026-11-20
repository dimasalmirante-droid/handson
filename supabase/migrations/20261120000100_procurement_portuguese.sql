-- Handson · Portuguese name for "Procurement"
--
-- The job function and the skill were seeded with the English name in the
-- Portuguese column, so Portuguese pages showed "Procurement". Reference data
-- only; only rows that still carry the untranslated value are changed, so an
-- administrator's own correction is never overwritten.

update public.job_functions
   set name_pt = 'Compras e Aprovisionamento'
 where code = 'procurement'
   and name_pt = 'Procurement';

update public.skill_catalogue
   set name_pt = 'Compras e aprovisionamento'
 where name_en = 'Procurement'
   and name_pt = 'Procurement';
