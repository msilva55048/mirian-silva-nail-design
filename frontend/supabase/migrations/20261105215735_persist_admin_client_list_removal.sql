begin;

alter table public.client_profiles
    add column if not exists admin_hidden_at timestamptz;

commit;
