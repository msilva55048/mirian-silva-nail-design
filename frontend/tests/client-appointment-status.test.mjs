import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/App.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260912160000_client_confirmation_status.sql", "utf8");

test("status visual da cliente respeita precedência e confirmação persistente", () => {
  assert.match(source, /appointment\.status === "cancelled".*Cancelado/s);
  assert.match(source, /appointment\.status === "completed".*Realizado/s);
  assert.match(source, /appointment\.confirmation_sent_at.*Confirmado/s);
  assert.match(source, /return \{label: "Agendado"/);
  assert.match(migration, /add column if not exists confirmation_sent_at/);
});

test("histórico da cliente ordena pela data e horário do appointment", () => {
  assert.match(source, /return second - first/);
  assert.doesNotMatch(source, /if \(aActive !== bActive\)/);
});

test("ação de confirmação registra o acionamento no banco", () => {
  const admin = fs.readFileSync("src/features/admin/AdminPanel.tsx", "utf8");
  assert.match(admin, /mark_appointment_confirmation_sent/);
  assert.match(admin, /Marcar como enviada/);
  assert.doesNotMatch(admin, /\.from\("appointments"\)\.update\(\{confirmation_sent_at/);
});

test("pendência é derivada do banco e abrir WhatsApp não a remove", () => {
  const admin = fs.readFileSync("src/features/admin/AdminPanel.tsx", "utf8");
  assert.match(admin, /filter\(\(notification\) => !notification\.appointment\.confirmation_sent_at\)/);
  assert.match(admin, /function markWhatsAppNotificationOpened/);
});
