import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20260909100000_fix_client_registration_push.sql", import.meta.url), "utf8");

async function database() {
    const db = new PGlite();
    await db.exec(`
        create schema auth;
        create role anon;
        create role authenticated;
        create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
        create table push_admin_config(singleton boolean primary key default true check (singleton), admin_user_id uuid not null);
        insert into push_admin_config(singleton, admin_user_id) values (true, '00000000-0000-4000-8000-000000000099');
        create table appointment_push_events(
            id uuid primary key default gen_random_uuid(), appointment_id uuid not null,
            event_type text not null check (event_type in ('created','rescheduled','cancelled')),
            actor_user_id uuid not null, client_name text not null, service_name text not null,
            source_transaction_id bigint not null default txid_current(), status text not null default 'pending',
            attempts integer not null default 0, created_at timestamptz not null default now()
        );
        create table client_profiles(
            id uuid primary key, user_id uuid, full_name text not null, phone text, email text,
            created_at timestamptz not null default now(), updated_at timestamptz not null default now()
        );
    `);
    await db.exec(migration);
    return db;
}

test("cadastro completo no INSERT cria uma notificação", async () => {
    const db = await database();
    try {
        await db.exec("insert into client_profiles(id,user_id,full_name) values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','Ana')");
        assert.equal((await db.query("select count(*) as n from appointment_push_events where event_type='client_registered'")).rows[0].n, 1);
    } finally { await db.close(); }
});

test("perfil inicialmente incompleto gera uma única notificação no primeiro claim", async () => {
    const db = await database();
    try {
        await db.exec("insert into client_profiles(id,user_id,full_name) values ('00000000-0000-4000-8000-000000000002',null,'Bia')");
        await db.exec("update client_profiles set user_id='00000000-0000-4000-8000-000000000011' where id='00000000-0000-4000-8000-000000000002'");
        await db.exec("update client_profiles set user_id='00000000-0000-4000-8000-000000000011', full_name='Bia Atualizada' where id='00000000-0000-4000-8000-000000000002'");
        const rows = (await db.query("select event_type,actor_user_id,client_name from appointment_push_events")).rows;
        assert.deepEqual(rows, [{event_type:"client_registered", actor_user_id:"00000000-0000-4000-8000-000000000011", client_name:"Bia"}]);
    } finally { await db.close(); }
});

test("edição de cliente já vinculada não cria nova notificação", async () => {
    const db = await database();
    try {
        await db.exec("insert into client_profiles(id,user_id,full_name) values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000012','Carla')");
        await db.exec("update client_profiles set full_name='Carla Editada', phone='48999999999' where id='00000000-0000-4000-8000-000000000003'");
        assert.equal((await db.query("select count(*) as n from appointment_push_events where appointment_id='00000000-0000-4000-8000-000000000003'")).rows[0].n, 1);
    } finally { await db.close(); }
});

test("admin não gera evento de nova cliente", async () => {
    const db = await database();
    try {
        await db.exec("insert into client_profiles(id,user_id,full_name) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000099','Mirian')");
        assert.equal((await db.query("select count(*) as n from appointment_push_events")).rows[0].n, 0);
    } finally { await db.close(); }
});

test("migração mantém o endpoint e o texto da nova cliente", () => {
    assert.match(migration, /after insert or update of user_id on public\.client_profiles/);
    assert.match(migration, /new\.user_id, new\.full_name, ''/);
    assert.match(migration, /appointment_push_events_client_registered_uidx/);
    assert.match(migration, /client_registered/);
});
