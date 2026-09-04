import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {hasScheduleBlockConflict} from "../src/features/admin/scheduleBlockConflicts.ts";

const block = {block_date: "2030-01-07", start_time: "09:00:00", end_time: "10:00:00"};
for (const [name, time, duration, expected] of [
    ["horário livre", "07:00", 60, false],
    ["totalmente bloqueado", "09:00", 30, true],
    ["duração invade bloqueio", "08:30", 60, true],
    ["sobreposição parcial no fim", "09:30", 60, true],
    ["serviço contém o bloqueio", "08:00", 180, true],
    ["termina no início do bloqueio", "08:00", 60, false],
    ["começa no fim do bloqueio", "10:00", 60, false],
    ["fora do período", "17:00", 120, false],
    ["precisão de segundos", "08:59:30", 1, true],
]) test(name, () => assert.equal(hasScheduleBlockConflict([block], "2030-01-07", time, duration), expected));

test("outra data não interfere", () => assert.equal(hasScheduleBlockConflict([block], "2030-01-08", "09:00", 60), false));
test("serviço cruza meia-noite e encontra bloqueio no dia seguinte", () => {
    assert.equal(hasScheduleBlockConflict([{...block, start_time: "00:15", end_time: "01:00"}], "2030-01-06", "23:30", 60), true);
});
test("bloqueio cruza meia-noite", () => {
    assert.equal(hasScheduleBlockConflict([{...block, start_time: "23:30", end_time: "00:30"}], "2030-01-08", "00:00", 30), true);
});
test("intervalo vazio não bloqueia", () => assert.equal(hasScheduleBlockConflict([{...block, end_time: block.start_time}], "2030-01-07", "08:30", 60), false));
test("bloqueios múltiplos", () => assert.equal(hasScheduleBlockConflict([block, {...block, start_time: "17:00", end_time: "17:30"}], "2030-01-07", "16:30", 60), true));

// Inspeção estrutural do SQL, SEM executá-lo em nenhum banco.
test("migration final contém integridade, RLS e guarda anterior ao cadastro", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20260903000000_admin_waiting_list.sql", import.meta.url), "utf8");
    assert.match(sql, /begin;[\s\S]+commit;/);
    assert.match(sql, /references public\.client_profiles\(id\)/);
    assert.match(sql, /unique \(client_id\)/);
    assert.match(sql, /enable row level security/);
    assert.equal((sql.match(/select public\.is_admin\(\)/g) ?? []).length, 3);
    assert.match(sql, /lock table public\.schedule_blocks in share mode/);
    assert.match(sql, /make_interval\(mins => v_service\.duration_minutes\)/);
    assert.match(sql, /pg_get_functiondef/);
    assert.match(sql, /v_guard \|\| v_anchor/);
    assert.match(sql, /v_anchor constant text := '    if p_client_profile_id is not null then'/);
    assert.match(sql, /raise exception 'Este período entra em conflito com um bloqueio/);
});


test("preferências adicionam somente campos nullable, sem alterar a estrutura existente", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20260903010000_waiting_list_preferences.sql", import.meta.url), "utf8");
    const statements = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
    assert.equal(statements, "begin; alter table public.waiting_list add column preferred_date date, add column preferred_time time without time zone; commit;");
});
