begin;

create or replace function public.can_manage_client_profile_photo(p_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p_profile_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.client_profiles as cp
      where cp.id::text = p_profile_id
        and (cp.user_id = auth.uid() or public.is_admin())
    );
$$;

alter function public.can_manage_client_profile_photo(text) owner to postgres;
revoke all on function public.can_manage_client_profile_photo(text) from public, anon, service_role;
grant execute on function public.can_manage_client_profile_photo(text) to authenticated;

drop policy if exists "Client profile photos readable by owner and admin" on storage.objects;
drop policy if exists "Client profile photos insertable by owner and admin" on storage.objects;
drop policy if exists "Client profile photos updatable by owner and admin" on storage.objects;
drop policy if exists "Client profile photos deletable by owner and admin" on storage.objects;

create policy "Client profile photos readable by owner and admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile[.]jpg$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

create policy "Client profile photos insertable by owner and admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile[.]jpg$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

create policy "Client profile photos updatable by owner and admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile[.]jpg$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
)
with check (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile[.]jpg$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

create policy "Client profile photos deletable by owner and admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-profile-photos'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile[.]jpg$'
  and public.can_manage_client_profile_photo(split_part(name, '/', 1))
);

commit;
