-- Alinha a policy dos bloqueios com o mesmo autorizador usado pelo painel ADM.
-- Mantém RLS, acesso somente a authenticated e a checagem administrativa.
begin;

drop policy if exists "ADM gerencia bloqueios" on public.schedule_blocks;

create policy "ADM gerencia bloqueios"
    on public.schedule_blocks
    as permissive
    for all
    to authenticated
    using ((select public.is_mirian_admin()))
    with check ((select public.is_mirian_admin()));

commit;
