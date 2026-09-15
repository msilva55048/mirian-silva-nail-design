import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260915150000_waitlist_request_lifecycle.sql", import.meta.url), "utf8");

test("modal identifica recusa sem usar Fechar como ação", () => {
  assert.match(app, /Recusar agendamento/);
  assert.doesNotMatch(app, /onClick=\{\(\) => void dismissClientOpportunity\(\)\}>Fechar</);
});

test("claim atualiza imediatamente os agendamentos e a lista de espera", () => {
  assert.match(app, /result === "claimed"[\s\S]*loadClientAppointments[\s\S]*loadClientWaitlistRequests/);
  assert.match(app, /dismiss_waitlist_opportunity/);
});

test("leitura da lista expira somente semana encerrada no fuso de São Paulo e retorna apenas ativas", () => {
  assert.match(migration, /status = 'expired'/);
  assert.match(migration, /week_end < \(now\(\) at time zone 'America\/Sao_Paulo'\)::date/);
  assert.match(migration, /r\.status = 'active'/);
  assert.match(migration, /grant execute on function public\.get_my_waitlist_requests\(\) to authenticated/);
});
