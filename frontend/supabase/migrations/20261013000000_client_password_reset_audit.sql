create table if not exists public.client_password_reset_audit (
    id uuid primary key default gen_random_uuid(),
    admin_user_id uuid not null references auth.users(id) on delete restrict,
    client_user_id uuid not null references auth.users(id) on delete restrict,
    client_profile_id uuid not null references public.client_profiles(id) on delete restrict,
    outcome text not null default 'requested' check (outcome in ('requested', 'completed', 'failed')),
    created_at timestamptz not null default now()
);

alter table public.client_password_reset_audit enable row level security;
revoke all on public.client_password_reset_audit from anon, authenticated;
grant all on public.client_password_reset_audit to service_role;

comment on table public.client_password_reset_audit is
    'Auditoria de redefinições de senha de clientes; nunca armazena senhas.';
