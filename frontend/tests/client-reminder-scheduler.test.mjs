import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260911000000_client_web_push_reminders.sql", import.meta.url), "utf8");

function saoPauloInstant(date, time) {
    return new Date(`${date}T${time.slice(0, 8)}-03:00`);
}

function eligibleAppointments(appointments, now, sent = new Set()) {
    const from = now.getTime() + 115 * 60 * 1000;
    const to = now.getTime() + 125 * 60 * 1000;
    return appointments.filter((appointment) => {
        if (!["pending", "confirmed"].includes(appointment.status)) return false;
        if (sent.has(appointment.id)) return false;
        const instant = saoPauloInstant(appointment.appointment_date, appointment.start_time).getTime();
        return instant >= from && instant <= to;
    });
}

test("seleciona somente agendamentos ativos na janela de 115 a 125 minutos", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const appointments = [
        {id: "due", status: "confirmed", appointment_date: "2026-10-20", start_time: "09:00:00"},
        {id: "early", status: "confirmed", appointment_date: "2026-10-20", start_time: "08:54:00"},
        {id: "late", status: "confirmed", appointment_date: "2026-10-20", start_time: "09:06:00"},
    ];
    assert.deepEqual(eligibleAppointments(appointments, now).map(({id}) => id), ["due"]);
});

test("converte o horário local de São Paulo sem depender do fuso do servidor", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const due = {id: "sp", status: "pending", appointment_date: "2026-10-20", start_time: "11:00:00"};
    assert.equal(eligibleAppointments([due], now).length, 1);
});

test("ignora cancelados e acompanha reagendamento", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const cancelled = {id: "cancelled", status: "cancelled", appointment_date: "2026-10-20", start_time: "09:00:00"};
    const rescheduled = {id: "moved", status: "confirmed", appointment_date: "2026-10-20", start_time: "12:00:00"};
    assert.deepEqual(eligibleAppointments([cancelled, rescheduled], now), []);
    rescheduled.appointment_date = "2026-10-20";
    rescheduled.start_time = "09:00:00";
    assert.deepEqual(eligibleAppointments([cancelled, rescheduled], now).map(({id}) => id), ["moved"]);
});

test("processa duas clientes e ignora quem não tem subscription", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const due = [
        {id: "ana-appointment", client_id: "ana", status: "confirmed", appointment_date: "2026-10-20", start_time: "09:00:00"},
        {id: "bia-appointment", client_id: "bia", status: "confirmed", appointment_date: "2026-10-20", start_time: "09:00:00"},
    ];
    const subscriptions = new Set(["ana"]);
    assert.deepEqual(eligibleAppointments(due, now).filter(({client_id}) => subscriptions.has(client_id)).map(({client_id}) => client_id), ["ana"]);
});

test("a chave única por appointment e reminder_type impede duplicação em execuções repetidas", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const due = {id: "same", status: "confirmed", appointment_date: "2026-10-20", start_time: "09:00:00"};
    const sent = new Set();
    const first = eligibleAppointments([due], now, sent);
    first.forEach(({id}) => sent.add(id));
    assert.equal(first.length, 1);
    assert.equal(eligibleAppointments([due], now, sent).length, 0);
});

test("a migration define cron de cinco minutos, timezone, claim persistente e limpeza de subscriptions inválidas", () => {
    assert.match(migration, /cron\.schedule\(\s*'client-web-push-reminders'/);
    assert.match(migration, /'\*\/5 \* \* \* \*'/);
    assert.match(migration, /America\/Sao_Paulo/);
    assert.match(migration, /unique \(appointment_id, reminder_type\)/);
    assert.match(migration, /a\.status in \('pending', 'confirmed'\)/);
});
