import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");

test("appointment card preserves actions and navigates by client_id", () => {
  assert.match(source, /function openClientFromAppointment\(appointment: AdminAppointment\)/);
  assert.match(source, /`profile:\$\{appointment\.client_id\}`/);
  assert.match(source, /normalizeClientPhone\(item\.phone\) === appointmentPhone/);
  assert.match(source, /setClientSearch\(""\)/);
  assert.match(source, /openAdminDashboardView\("clients"\)/);
  assert.match(source, /openClientHistory\(client\)/);
  assert.match(source, /Editar agendamento/);
  assert.match(source, /Ir para cliente/);
  assert.match(source, /onClick=\{\(\) => void cancelAppointment\(appointment\)\}/);
  assert.match(source, /getWhatsAppNotificationLabel\(type\)/);
  assert.doesNotMatch(source, /Editar detalhes/);
});
