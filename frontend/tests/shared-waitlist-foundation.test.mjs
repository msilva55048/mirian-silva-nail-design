import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const sql = readFileSync(new URL("../supabase/migrations/20260911100000_shared_waitlist_foundation.sql", import.meta.url), "utf8");

test("fundação da lista compartilhada é aditiva e mantém waiting_list antiga", () => {
    assert.match(sql, /create table if not exists public\.waiting_list_requests/i);
    assert.match(sql, /create table if not exists public\.waitlist_opportunities/i);
    assert.match(sql, /create table if not exists public\.waitlist_push_dispatches/i);
    assert.doesNotMatch(sql, /drop table public\.waiting_list|alter table public\.waiting_list\s+(drop|rename)/i);
    assert.doesNotMatch(sql, /create trigger|appointment_push_events|client_push_reminders|cron\.schedule/i);
});

test("solicitações persistem semana útil, origem, snapshot e unicidade ativa", () => {
    assert.match(sql, /selected_date date not null/);
    assert.match(sql, /week_start date not null/);
    assert.match(sql, /week_end date not null/);
    assert.match(sql, /service_name_snapshot text not null/);
    assert.match(sql, /source text not null check \(source in \('client', 'admin'\)\)/);
    assert.match(sql, /status text not null default 'active'/);
    assert.match(sql, /where status = 'active'/);
    assert.match(sql, /create or replace function public\.waitlist_week_start/i);
});

test("RPCs autenticadas cobrem cliente e Admin sem aceitar client_id no fluxo da cliente", () => {
    for (const name of [
        "create_my_waitlist_request",
        "get_my_waitlist_requests",
        "cancel_my_waitlist_request",
        "admin_list_waitlist_requests",
        "admin_create_waitlist_request",
        "admin_cancel_waitlist_request",
    ]) assert.match(sql, new RegExp(`function public\\.${name}`, "i"));
    assert.match(sql, /v_user_id uuid := auth\.uid\(\)/);
    assert.match(sql, /values \(v_client_id, v_service\.id/);
});

test("regras de data, serviço ativo e isolamento RLS estão declaradas", () => {
    assert.match(sql, /extract\(isodow from p_selected_date\) > 5/);
    assert.match(sql, /America\/Sao_Paulo/);
    assert.match(sql, /s\.is_active = true/);
    assert.match(sql, /alter table public\.waiting_list_requests enable row level security/i);
    assert.match(sql, /alter table public\.waitlist_opportunities enable row level security/i);
    assert.match(sql, /alter table public\.waitlist_push_dispatches enable row level security/i);
    assert.match(sql, /waiting_list_requests_admin_select/);
});
