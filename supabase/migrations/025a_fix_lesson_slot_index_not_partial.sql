-- ============================================================================
-- 025a_fix_lesson_slot_index_not_partial.sql
-- Етап 6 · виправлення до 025 · адитивне · ДО 020
--
-- Індекс star_entries_lesson_slot_uq мусить бути ПОВНИМ, а не частковим.
--
-- Чому: PostgREST (supabase-js .upsert) будує `ON CONFLICT (cols) DO UPDATE`
-- без WHERE-предиката. PostgreSQL виводить частковий унікальний індекс лише
-- тоді, коли його предикат випливає з WHERE самого запиту — тут такого WHERE
-- немає, тож автозбереження журналу впало б із
--   «no unique or exclusion constraint matching the ON CONFLICT specification».
--
-- Семантика від зняття предиката не змінюється: UNIQUE трактує NULL як різні
-- значення, тому рядки поза уроком (lesson_id IS NULL — бонуси, штрафи,
-- класові нарахування) не конфліктують між собою в жодному з варіантів.
--
-- Файл ідемпотентний: на свіжій БД 025 уже створює повний індекс, і цей файл
-- лише перестворює його без змін.
-- ============================================================================

DROP INDEX IF EXISTS public.star_entries_lesson_slot_uq;
CREATE UNIQUE INDEX star_entries_lesson_slot_uq
  ON public.star_entries (student_id, lesson_id, entry_type_id);

COMMENT ON INDEX public.star_entries_lesson_slot_uq IS
  'Опора для upsert журналу після 020 (замінник unique_student_lesson_type_star).';
