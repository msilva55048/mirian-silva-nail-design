-- Preparada, não aplicada. Uma linha por cliente; preferências não são reservas.
begin;
alter table public.waiting_list
    add column preferred_dates date[],
    add column preferred_times time without time zone[];

-- Conserva as colunas antigas e leva os valores existentes aos novos conjuntos.
-- NULL nos arrays também permite fallback para entradas gravadas pelo frontend antigo.
update public.waiting_list
   set preferred_dates = case when preferred_date is null then null else array[preferred_date] end,
       preferred_times = case when preferred_time is null then null else array[preferred_time] end;
commit;
