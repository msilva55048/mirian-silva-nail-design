import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

const migration = await readFile(new URL("../supabase/migrations/20260914100000_fix_waitlist_opportunity_claim_contract.sql", import.meta.url), "utf8");
const claim = async (db, opportunityId) => (await db.query("select claim_waitlist_opportunity($1) as result", [opportunityId])).rows[0].result;
const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

test("claim da oportunidade protege autorização, contrato, bloqueios e idempotência", async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon;
            create role authenticated;
            create schema auth;
            create table auth.session(user_id uuid);
            create function auth.uid() returns uuid language sql stable as $$ select user_id from auth.session limit 1 $$;
            create table client_profiles(id uuid primary key, user_id uuid unique, full_name text, phone text, email text);
            create table services(id bigint primary key, name text, duration_minutes integer, price_cents integer, is_active boolean);
            create table appointments(id uuid primary key default gen_random_uuid(), client_id uuid, client_name text, client_phone text, client_email text, service_name text, appointment_date date, start_time time, duration_minutes integer, price_cents integer, status text);
            create table waiting_list_requests(id uuid primary key, client_id uuid, service_id bigint, status text, week_start date, week_end date, created_at timestamptz default now(), updated_at timestamptz default now());
            create table waitlist_opportunities(id uuid primary key, source_appointment_id uuid, service_id bigint, service_name_snapshot text, appointment_date date, start_time time, duration_minutes integer, status text, expires_at timestamptz, claimed_by_client_id uuid, claimed_at timestamptz, claimed_appointment_id uuid, updated_at timestamptz default now());
            create table waitlist_push_dispatches(id uuid primary key, opportunity_id uuid, client_id uuid, subscription_id uuid, status text);
            create table schedule_blocks(block_date date, start_time time, end_time time);
            create function public.client_booking_start_allowed(date, time, text, integer, uuid) returns boolean language sql stable as $$ select true $$;
            insert into client_profiles values ('${uuid(1)}','${uuid(101)}','Ana','111','ana@test'), ('${uuid(2)}','${uuid(102)}','Bia','222','bia@test'), ('${uuid(3)}','${uuid(103)}','Cris','333','cris@test');
            insert into services values (1,'Reparo de Unha (Unitário)',20,500,true);
            insert into appointments(id,appointment_date,start_time,duration_minutes,status,service_name) values ('${uuid(50)}','2030-01-10','09:00',20,'cancelled','Reparo de Unha (Unitário)');
        `);
        await db.exec(migration);
        let requestCounter = 200;
        let dispatchCounter = 300;
        const addEligible = async (opportunityId, client = 1) => {
            await db.query("insert into waiting_list_requests(id,client_id,service_id,status,week_start,week_end) values($1,$2,1,'active','2030-01-07','2030-01-13')", [uuid(requestCounter++), uuid(client)]);
            await db.query("insert into waitlist_push_dispatches(id,opportunity_id,client_id,subscription_id,status) values($1,$2,$3,$4,'sent')", [uuid(dispatchCounter++), opportunityId, uuid(client), uuid(400 + dispatchCounter)]);
        };
        const addOpportunity = async (opportunityId, start = "09:00", source = uuid(50)) => db.query("insert into waitlist_opportunities(id,source_appointment_id,service_id,service_name_snapshot,appointment_date,start_time,duration_minutes,status,expires_at) values($1,$2,1,'Reparo de Unha (Unitário)','2030-01-10',$3,20,'open',now()+interval '1 day')", [opportunityId, source, start]);

        const first = uuid(500); await addOpportunity(first); await addEligible(first); await db.exec(`insert into auth.session values ('${uuid(101)}')`);
        const firstClaim = await claim(db, first);
        assert.equal(firstClaim.result, "claimed");
        assert.equal((await db.query("select status from appointments where id=$1", [firstClaim.appointment_id])).rows[0].status, "confirmed");
        assert.equal((await db.query("select status from waitlist_opportunities where id=$1", [first])).rows[0].status, "claimed");
        assert.equal((await db.query("select status from waiting_list_requests where client_id=$1", [uuid(1)])).rows[0].status, "fulfilled");
        assert.equal((await claim(db, first)).result, "already_claimed_by_you");
        await db.exec(`update auth.session set user_id='${uuid(102)}'`);
        assert.equal((await claim(db, first)).result, "already_claimed");

        const unauthorized = uuid(501); await addOpportunity(unauthorized, "10:00");
        await db.exec(`update auth.session set user_id='${uuid(103)}'`);
        assert.equal((await claim(db, unauthorized)).result, "unauthorized");

        const blocked = uuid(502); await addOpportunity(blocked, "11:00"); await addEligible(blocked, 2);
        await db.exec(`insert into schedule_blocks values('2030-01-10','11:20','11:30'); update auth.session set user_id='${uuid(102)}'`);
        assert.equal((await claim(db, blocked)).result, "unavailable", "Reparo ocupa 30 minutos na agenda");

        const restored = uuid(503); const restoredSource = uuid(51);
        await db.query("insert into appointments(id,appointment_date,start_time,duration_minutes,status,service_name) values($1,'2030-01-10','12:00',20,'confirmed','Reparo de Unha (Unitário)')", [restoredSource]);
        await addOpportunity(restored, "12:00", restoredSource); await addEligible(restored, 2);
        assert.equal((await claim(db, restored)).result, "unavailable", "vaga restaurada não pode ser reivindicada");

        const expired = uuid(504); await addOpportunity(expired, "13:00"); await addEligible(expired, 2);
        await db.query("update waitlist_opportunities set expires_at=now()-interval '1 second' where id=$1", [expired]);
        assert.equal((await claim(db, expired)).result, "expired");
    } finally { await db.close(); }
});

test("migration mantém lock, identidade por auth e a UI trata respostas controladas", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
    assert.match(migration, /auth\.uid\(\)/i);
    assert.match(migration, /for update/i);
    assert.match(migration, /pg_advisory_xact_lock/i);
    assert.match(migration, /v_agenda_duration/i);
    assert.match(migration, /'confirmed'/i);
    assert.match(app, /Esta vaga já foi preenchida\./);
    assert.match(app, /claim_waitlist_opportunity/);
});
