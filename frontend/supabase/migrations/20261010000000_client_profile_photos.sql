begin;

alter table public.client_profiles
  add column if not exists profile_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-profile-photos', 'client-profile-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Client profile photos readable by owner and admin" on storage.objects;
create policy "Client profile photos readable by owner and admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-profile-photos'
  and (public.is_admin() or name = (select id::text || '/profile.jpg' from public.client_profiles where user_id = auth.uid() limit 1))
);

drop policy if exists "Client profile photos insertable by owner and admin" on storage.objects;
create policy "Client profile photos insertable by owner and admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-profile-photos'
  and (public.is_admin() or name = (select id::text || '/profile.jpg' from public.client_profiles where user_id = auth.uid() limit 1))
);

drop policy if exists "Client profile photos updatable by owner and admin" on storage.objects;
create policy "Client profile photos updatable by owner and admin"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-profile-photos'
  and (name = (select id::text || '/profile.jpg' from public.client_profiles where user_id = auth.uid() limit 1) or public.is_admin())
)
with check (
  bucket_id = 'client-profile-photos'
  and (name = (select id::text || '/profile.jpg' from public.client_profiles where user_id = auth.uid() limit 1) or public.is_admin())
);

drop policy if exists "Client profile photos deletable by owner and admin" on storage.objects;
create policy "Client profile photos deletable by owner and admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-profile-photos'
  and (name = (select id::text || '/profile.jpg' from public.client_profiles where user_id = auth.uid() limit 1) or public.is_admin())
);

commit;
