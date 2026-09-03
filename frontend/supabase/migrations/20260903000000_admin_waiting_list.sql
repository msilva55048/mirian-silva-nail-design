-- Migration aplicada manualmente ao Supabase de produção em 03/09/2026.
-- Consolida waiting_list e a proteção da RPC administrativa contra bloqueios.
-- Usa is_admin(), a mesma autorização da RPC já existente.
-- A transação inteira é revertida se qualquer pré-condição ou etapa falhar.
begin;

do $$
begin
    if to_regprocedure('public.is_admin()') is null then
        raise exception 'Pré-requisito ausente: public.is_admin(). Nada foi aplicado.';
    end if;
end;
$$;

create table public.waiting_list (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.client_profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint waiting_list_client_id_key unique (client_id)
);

create index waiting_list_created_at_idx on public.waiting_list (created_at, id);

alter table public.waiting_list enable row level security;
revoke all on public.waiting_list from anon, authenticated;
grant select, insert, delete on public.waiting_list to authenticated;
grant all on public.waiting_list to service_role;

create policy waiting_list_admin_select on public.waiting_list for select to authenticated
    using ((select public.is_admin()));
create policy waiting_list_admin_insert on public.waiting_list for insert to authenticated
    with check ((select public.is_admin()));
create policy waiting_list_admin_delete on public.waiting_list for delete to authenticated
    using ((select public.is_admin()));

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table public.waiting_list;
    end if;
end;
$$;

-- Modifica apenas o corpo da assinatura conhecida, preservando argumentos,
-- defaults, retorno, SECURITY DEFINER, search_path, owner e permissões existentes.
-- Em vez de substituir toda a RPC por uma cópia possivelmente desatualizada,
-- preserva sua definição atual e insere SOMENTE a validação abaixo. Se a posição
-- revisada no código original mudou, falha explicitamente para nova revisão.
do $migration$
declare
    v_function regprocedure := to_regprocedure(
        'public.admin_create_client_appointment(uuid,text,text,text,text,date,time without time zone,integer,integer)'
    );
    v_definition text;
    v_source text;
    v_anchor constant text := '    if p_client_profile_id is not null then';
    v_guard constant text := $guard$
    -- schedule_blocks_guard_v1
    -- SHARE impede INSERT/UPDATE/DELETE concorrentes de bloqueios entre a
    -- verificação e o commit do agendamento. Não bloqueia SELECTs nem outras
    -- chamadas desta RPC com o mesmo lock. Aguarda gravações já em andamento.
    lock table public.schedule_blocks in share mode;

    if exists (
        select 1
          from public.schedule_blocks as sb
         where
            -- Ignora intervalos vazios; fim menor que início atravessa meia-noite.
            sb.start_time <> sb.end_time
            and (p_appointment_date + p_start_time) <
                (sb.block_date + sb.end_time +
                    case when sb.end_time < sb.start_time
                         then interval '1 day' else interval '0 days' end)
            and (p_appointment_date + p_start_time +
                    make_interval(mins => v_service.duration_minutes)) >
                (sb.block_date + sb.start_time)
    ) then
        raise exception 'Este período entra em conflito com um bloqueio de horário. Escolha outro horário.'
            using errcode = 'P0001';
    end if;

$guard$;
begin
    if v_function is null then
        raise exception 'Assinatura esperada de admin_create_client_appointment não encontrada. Nada foi aplicado.';
    end if;

    select pg_get_functiondef(p.oid), p.prosrc
      into v_definition, v_source
      from pg_proc p
     where p.oid = v_function;

    if strpos(v_source, 'schedule_blocks_guard_v1') > 0 then
        raise exception 'A RPC já contém esta proteção. Revise o histórico de migrations antes de continuar.';
    end if;

    if (length(v_source) - length(replace(v_source, v_anchor, ''))) <> length(v_anchor)
       or strpos(v_source, 'Configuração inválida do serviço.') = 0
       or strpos(v_source, 'Configuração inválida do serviço.') > strpos(v_source, v_anchor)
       or strpos(v_source, 'insert into public.client_profiles') < strpos(v_source, v_anchor)
       or strpos(v_source, 'insert into public.appointments') < strpos(v_source, v_anchor)
    then
        raise exception 'A RPC divergiu da estrutura revisada. Migration interrompida; revise a definição antes de aplicar.';
    end if;

    execute replace(v_definition, v_source, replace(v_source, v_anchor, v_guard || v_anchor));
end;
$migration$;

commit;
