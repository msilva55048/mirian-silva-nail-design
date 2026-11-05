import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {PGlite} from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261105215735_persist_admin_client_list_removal.sql", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("marcador persistente esconde registros anteriores e um novo agendamento restaura a cliente", async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create table public.client_profiles (
                id uuid primary key,
                full_name text not null
            );
            create table public.appointments (
                id uuid primary key,
                client_id uuid references public.client_profiles(id),
                client_hidden boolean not null default false,
                status text not null,
                price_cents integer not null,
                created_at timestamptz not null default '2029-01-01T00:00:00Z'
            );
            insert into public.client_profiles(id,full_name) values
                ('00000000-0000-0000-0000-000000000007','Sem agendamentos'),
                ('00000000-0000-0000-0000-000000000008','Com histórico'),
                ('00000000-0000-0000-0000-000000000009','Com ativo');
            insert into public.appointments(id,client_id,status,price_cents) values
                ('20000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000008','completed',8500),
                ('20000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009','confirmed',12000);
        `);
        await db.exec(migration);
        assert.deepEqual((await db.query("select admin_hidden_at from public.client_profiles order by id")).rows.map((row) => row.admin_hidden_at), [null, null, null]);
        await db.exec("update public.client_profiles set admin_hidden_at='2030-01-01T00:00:00Z';");
        const before = (await db.query("select id,client_id,client_hidden,status,price_cents,created_at from public.appointments order by id")).rows;

        let visible=(await db.query(`
            select cp.id from public.client_profiles cp
            where exists (select 1 from public.appointments a where a.client_id=cp.id and not a.client_hidden and a.created_at>cp.admin_hidden_at)
            order by cp.id
        `)).rows;
        assert.deepEqual(visible, [], "without a booking created after removal, the profile is hidden even if it had no bookings");

        await db.exec("insert into public.appointments(id,client_id,status,price_cents,created_at) values ('20000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007','confirmed',5000,'2030-01-01T00:00:01Z');");
        visible=(await db.query(`
            select cp.id from public.client_profiles cp
            where exists (select 1 from public.appointments a where a.client_id=cp.id and not a.client_hidden and a.created_at>cp.admin_hidden_at)
            order by cp.id
        `)).rows;
        assert.deepEqual(visible, [{id:"00000000-0000-0000-0000-000000000007"}], "a later booking restores visibility while old appointments remain excluded from the client card");
        assert.deepEqual((await db.query("select id,client_id,client_hidden,status,price_cents,created_at from public.appointments where id in ('20000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000009') order by id")).rows, before);
        assert.equal((await db.query("select sum(price_cents)::int as total from public.appointments")).rows[0].total, 25500, "historic and active appointment data and prices remain intact");
    } finally {
        await db.close();
    }
});

test("painel carrega o marcador, aplica a data de corte e valida registros retornados", () => {
    assert.match(app, /profile_photo_path, admin_hidden_at, created_at/);
    assert.match(app, /new Date\(appointment\.created_at\)\.getTime\(\) > removedAt/);
    assert.match(app, /\.update\(\{admin_hidden_at: removedAt\}\)[\s\S]*?\.select\("id, admin_hidden_at"\)/);
    assert.match(app, /Nenhum cadastro foi atualizado/);
    assert.match(app, /Nem todos os registros foram atualizados/);
    assert.match(migration, /alter table public\.client_profiles\s+add column if not exists admin_hidden_at timestamptz/);
    assert.doesNotMatch(migration, /enable row level security|create policy|drop policy|delete from public\.(appointments|client_profiles)/i);
});
