import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const app = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");

test("calendário usa a disponibilidade real para bloquear dias sem horários", () => {
  assert.match(app, /function isBookingDateUnavailable\(date: string\)/);
  assert.match(app, /getAvailableTimes\(date, selectedServiceInformation\.durationMinutes\)\.length === 0/);
  assert.match(app, /disabled=\{isPast \|\| isBlocked\}/);
  assert.match(app, /\.client-month-calendar__day\.is-blocked::after[\s\S]*content: none/);
});
