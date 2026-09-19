-- waitlist_opportunities representa uma vaga, não uma cliente específica.
-- A distribuição para clientes elegíveis é responsabilidade do dispatcher de
-- oportunidades; esta função legada não pode acessar uma cliente destinatária.
begin;

create or replace function public.capture_waitlist_client_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    -- Mantém o trigger compatível, sem criar notificação individual para uma
    -- vaga que ainda não tem cliente destinatária.
    return new;
end;
$function$;

commit;
