-- Preparada; não aplicada. Preferências informativas, sem reserva de horário.
-- Campos nullable preservam registros anteriores. PK, FK, UNIQUE, RLS,
-- policies e publicação Realtime permanecem inalterados.
begin;
alter table public.waiting_list
    add column preferred_date date,
    add column preferred_time time without time zone;
commit;
