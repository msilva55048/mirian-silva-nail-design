-- Registro mínimo e auditável da ação de confirmação acionada pelo painel.
alter table public.appointments
  add column if not exists confirmation_sent_at timestamptz;
create index if not exists appointments_confirmation_sent_idx
  on public.appointments(confirmation_sent_at)
  where confirmation_sent_at is not null;
