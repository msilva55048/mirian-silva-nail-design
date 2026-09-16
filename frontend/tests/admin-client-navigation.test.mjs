import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "src/features/admin/AdminPanel.tsx"), "utf8");

test("agendamento navega para a cliente pelo client_id e preserva fallback legado", () => {
  assert.match(source, /function openClientFromAppointment\(appointment: AdminAppointment\)/);
  assert.match(source, /`profile:\$\{appointment\.client_id\}`/);
  assert.match(source, /normalizeClientPhone\(item\.phone\) === appointmentPhone/);
  assert.match(source, /setClientSearch\(""\)/);
  assert.match(source, /openAdminDashboardView\("clients"\)/);
  assert.match(source, /openClientHistory\(client\)/);
  assert.match(source, /Ir para cliente/);
  assert.match(source, /Editar agendamento/);
  assert.doesNotMatch(source, /Editar detalhes/);
});
