begin;

-- Keep existing profile.jpg paths valid while allowing immutable v4 photo versions.
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

  if p_photo_path is not null and p_photo_path !~ (
    '^' || p_client_id::text || '/(profile[.]jpg|photo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg)$'
  ) then
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

drop policy if exists "Client profile photos readable by owner and admin" on storage.objects;
drop policy if exists "Client profile photos insertable by owner and admin" on storage.objects;
drop policy if exists "Client profile photos updatable by owner and admin" on storage.objects;
drop policy if exists "Client profile photos deletable by owner and admin" on storage.objects;

create policy "Client profile photos readable by owner and admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(profile[.]jpg|photo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg)$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

create policy "Client profile photos insertable by owner and admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(profile[.]jpg|photo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg)$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

create policy "Client profile photos updatable by owner and admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(profile[.]jpg|photo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg)$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
)
with check (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(profile[.]jpg|photo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg)$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

create policy "Client profile photos deletable by owner and admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(profile[.]jpg|photo-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg)$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

commit;
