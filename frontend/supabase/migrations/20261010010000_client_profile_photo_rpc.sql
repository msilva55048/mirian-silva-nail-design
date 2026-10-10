begin;

-- Keep the existing identity fields and behavior while returning the optional photo path.
drop function public.get_my_client_profile();
create function public.get_my_client_profile()
returns table (
  id uuid,
  full_name text,
  phone text,
  email text,
  phone_digits text,
  user_id uuid,
  profile_photo_path text
)
language sql
security definer
set search_path = public, auth
as $$
  select cp.id, cp.full_name, cp.phone, cp.email, cp.phone_digits, cp.user_id, cp.profile_photo_path
  from public.client_profiles cp
  where cp.user_id = auth.uid()
  limit 1;
$$;
alter function public.get_my_client_profile() owner to postgres;
grant execute on function public.get_my_client_profile() to anon, authenticated, service_role;

create or replace function public.set_client_profile_photo_path(p_client_id uuid, p_photo_path text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  if p_photo_path is not null and p_photo_path <> p_client_id::text || '/profile.jpg' then
    raise exception 'Caminho de foto inválido.' using errcode = '22023';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.client_profiles cp
    where cp.id = p_client_id and cp.user_id = auth.uid()
  ) then
    raise exception 'Você não pode alterar a foto desta cliente.' using errcode = '42501';
  end if;

  update public.client_profiles
  set profile_photo_path = p_photo_path, updated_at = now()
  where id = p_client_id;

  if not found then
    raise exception 'Perfil de cliente não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;
alter function public.set_client_profile_photo_path(uuid, text) owner to postgres;
revoke all on function public.set_client_profile_photo_path(uuid, text) from public, anon, service_role;
grant execute on function public.set_client_profile_photo_path(uuid, text) to authenticated;

commit;
