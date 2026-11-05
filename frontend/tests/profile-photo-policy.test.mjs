import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {test} from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20261105223023_client_profile_photo_versioned_upload.sql", import.meta.url), "utf8");
const adminId = "11111111-1111-4111-8111-111111111111";
const clientId = "22222222-2222-4222-8222-222222222222";
const otherClientId = "33333333-3333-4333-8333-333333333333";
const clientUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const outsiderId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function createDatabase() {
    const db = new PGlite();
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create schema storage;
        create function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        create table public.admin_users(user_id uuid primary key);
        insert into public.admin_users values ('${adminId}');
        create table public.client_profiles(
            id uuid primary key,
            user_id uuid,
            profile_photo_path text,
            updated_at timestamptz default now()
        );
        insert into public.client_profiles(id,user_id) values
            ('${clientId}','${clientUserId}'),
            ('${otherClientId}','${otherUserId}');
        create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
            select exists (select 1 from public.admin_users where user_id = auth.uid())
        $$;
        create function public.can_manage_client_profile_photo(p_profile_id text)
        returns boolean language sql stable security definer set search_path = pg_catalog, public, auth as $$
            select p_profile_id is not null and auth.uid() is not null and exists (
                select 1 from public.client_profiles cp
                where cp.id::text = p_profile_id and (cp.user_id = auth.uid() or public.is_admin())
            )
        $$;
        grant execute on function auth.uid() to authenticated;
        grant execute on function public.can_manage_client_profile_photo(text) to authenticated;
        grant usage on schema auth, storage to authenticated;
        create table storage.buckets(id text primary key, name text, public boolean not null);
        insert into storage.buckets values('client-profile-photos','client-profile-photos',false);
        create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
        alter table storage.objects enable row level security;
        grant select, insert, update, delete on storage.objects to authenticated;
    `);
    await db.exec(migration);
    return db;
}

async function assumeUser(db, userId) {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
}

test("storage policy and photo RPC allow ADM and owner, reject other clients, and keep the bucket private", async () => {
    const db = await createDatabase();
    try {
        const privateBucket = await db.query("select public from storage.buckets where id='client-profile-photos'");
        assert.equal(privateBucket.rows[0].public, false);

        const adminPhotoPath = `${clientId}/photo-12345678-1234-4234-8234-123456789abc.jpg`;
        await assumeUser(db, adminId);
        await db.query("insert into storage.objects(bucket_id,name) values('client-profile-photos',$1)", [adminPhotoPath]);
        await db.query("select public.set_client_profile_photo_path($1::uuid,$2)", [clientId, adminPhotoPath]);
        await db.exec("reset role;");
        const updated = await db.query("select profile_photo_path from public.client_profiles where id=$1::uuid", [clientId]);
        assert.equal(updated.rows[0].profile_photo_path, adminPhotoPath);

        const ownerPhotoPath = `${otherClientId}/photo-abcdefab-cdef-4abc-8def-abcdefabcdef.jpg`;
        await assumeUser(db, otherUserId);
        await db.query("insert into storage.objects(bucket_id,name) values('client-profile-photos',$1)", [ownerPhotoPath]);
        await db.query("select public.set_client_profile_photo_path($1::uuid,$2)", [otherClientId, ownerPhotoPath]);
        const ownRead = await db.query("select name from storage.objects where bucket_id='client-profile-photos' and name=$1", [ownerPhotoPath]);
        assert.equal(ownRead.rows.length, 1);

        await assumeUser(db, outsiderId);
        await assert.rejects(
            db.query("insert into storage.objects(bucket_id,name) values('client-profile-photos',$1)", [`${clientId}/photo-11111111-1111-4111-8111-111111111111.jpg`]),
            (error) => error.code === "42501",
        );
        await assert.rejects(
            db.query("select public.set_client_profile_photo_path($1::uuid,$2)", [clientId, adminPhotoPath]),
            (error) => error.code === "42501",
        );
        await assert.rejects(
            db.query("select public.set_client_profile_photo_path($1::uuid,$2)", [clientId, `${otherClientId}/photo-22222222-2222-4222-8222-222222222222.jpg`]),
            (error) => error.code === "22023",
        );
    } finally {
        await db.close();
    }
});
