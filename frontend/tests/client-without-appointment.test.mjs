import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source = readFileSync("src/features/admin/clientWithoutAppointment.ts", "utf8")
    .replace(/^import type .*?;\r?\n/m, "")
    .replace(/^import .*?;\r?\n/m, "")
    .replace("export function", "function");
const getIsClientInactive = new Function(
    "getAppointmentEndDateTime",
    `${ts.transpile(source)}; return isClientInactive;`,
)((appointment) => new Date(`${appointment.appointment_date}T${appointment.start_time}:00`));

const now = new Date("2030-02-01T12:00:00");
const isClientInactive = (client) => getIsClientInactive(client, now);
const appointment = (status, date, duration_minutes = 60) => ({
    status, appointment_date: date, start_time: "12:00", duration_minutes,
});
const client = (lastAppointment = null, nextAppointment = null) => ({lastAppointment, nextAppointment});

test("cliente sem futuro não usa histórico como estado atual e só fica inativa após mais de 30 dias", () => {
    assert.equal(isClientInactive(client()), false, "cliente sem histórico não é inativa");
    assert.equal(isClientInactive(client(appointment("completed", "2030-01-03"))), false, "menos de 30 dias");
    assert.equal(isClientInactive(client(appointment("completed", "2030-01-02"))), false, "exatamente 30 dias");
    assert.equal(isClientInactive(client(appointment("completed", "2030-01-01"))), true, "31 dias");
    assert.equal(isClientInactive(client(appointment("completed", "2029-12-01"), appointment("confirmed", "2030-02-02"))), false, "cliente com futuro não é inativa");
});
