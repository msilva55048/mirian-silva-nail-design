import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260912100000_waitlist_full_week.sql", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const admin = readFileSync(new URL("../src/features/admin/SharedWaitlist.tsx", import.meta.url), "utf8");

test("semana compartilhada usa domingo a sábado e recalcula registros existentes", () => {
  assert.match(migration, /extract\(dow from selected_date\)/i);
  assert.match(migration, /week_end = week_start \+ 6/i);
  assert.match(migration, /update public\.waiting_list_requests/i);
  assert.doesNotMatch(migration, /extract\(isodow from p_selected_date\) > 5/);
});

test("cliente e Admin aceitam todos os dias futuros da semana", () => {
  assert.match(client, /isBlocked = isClientBookingDateBlocked\(date\)/);
  assert.match(admin, /isClosed = isClientBookingDateBlocked\(date\)/);
  assert.match(client, /getWaitlistWeek/);
  assert.match(admin, /Semana:/);
});

test("busca Admin não abre lista completa e limita sugestões", () => {
  assert.match(admin, /Digite nome ou sobrenome/);
  assert.match(admin, /slice\(0, 8\)/);
  assert.match(admin, /setClientId\(""\)/);
});
