import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const admin = await readFile(new URL("../src/features/admin/AdminPanel.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260922090000_remove_loyalty_feature.sql", import.meta.url), "utf8");

test("interface e fluxo ADM não contêm mais integração de fidelidade", () => {
  assert.doesNotMatch(app, /loyalty|fidelidade|Cartão Fidelidade|loyaltyPreview/i);
  assert.doesNotMatch(admin, /loyalty|fidelidade|Cartão Fidelidade/i);
});

test("rollback desativa job e trigger, com guarda contra perda de histórico", () => {
  assert.match(migration, /cron\.unschedule/);
  assert.match(migration, /drop trigger if exists appointments_loyalty_change/);
  assert.match(migration, /contains records; removal paused/);
});

test("fila comum preserva Push de appointments e indicação, inclusive recompensa usada", () => {
  for (const type of ["appointment-created", "appointment-cancelled", "referral-registered", "referral-scheduled", "referral-qualified", "referral-reward-used"])
    assert.ok(migration.includes(`'${type}'`));
  assert.doesNotMatch(migration, /new\.type in \([\s\S]*?'loyalty-[^']+'/);
  assert.match(migration, /where s\.client_id=new\.client_id/);
});
