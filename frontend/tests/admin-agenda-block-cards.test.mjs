import assert from "node:assert/strict";
import {test} from "node:test";
import {formatAdminBlockReason, mergeAdminAgendaItems} from "../src/features/admin/adminAgendaBlocks.ts";

const appointment = (id, date, time) => ({id, appointment_date: date, start_time: time});
const block = (id, date, start, end, reason = null) => ({
    id,
    block_date: date,
    start_time: start,
    end_time: end,
    reason,
});

test("intercala atendimentos e bloqueios pela data e hora", () => {
    const entries = mergeAdminAgendaItems(
        [appointment("a2", "2026-11-03", "10:00:00"), appointment("a1", "2026-11-02", "11:00:00")],
        [block("b2", "2026-11-03", "09:00:00", "10:00:00"), block("b1", "2026-11-02", "10:00:00", "11:00:00")],
    );

    assert.deepEqual(entries.map(({kind, date, startTime}) => [kind, date, startTime.slice(0, 5)]), [
        ["block", "2026-11-02", "10:00"],
        ["appointment", "2026-11-02", "11:00"],
        ["block", "2026-11-03", "09:00"],
        ["appointment", "2026-11-03", "10:00"],
    ]);
});

test("uma data só com bloqueio continua visível na lista", () => {
    const entries = mergeAdminAgendaItems([], [block("b1", "2026-11-03", "09:00", "11:00")]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, "block");
});

test("motivo longo é preservado exatamente e motivo vazio não cria parênteses", () => {
    const reason = "Consulta médica especializada com retorno e exames complementares";
    assert.equal(formatAdminBlockReason(reason), `(${reason})`);
    assert.equal(formatAdminBlockReason("   "), null);
    assert.equal(formatAdminBlockReason(null), null);
});

test("remover o registro remove também o card da lista derivada", () => {
    const existing = [block("b1", "2026-11-03", "09:00", "11:00"), block("b2", "2026-11-03", "13:00", "14:00")];
    assert.deepEqual(mergeAdminAgendaItems([], existing.filter(({id}) => id !== "b1")).map(({id}) => id), ["b2"]);
});

test("a busca por cliente pode omitir bloqueios sem alterar a lista de atendimentos", () => {
    const appointments = [appointment("a1", "2026-11-03", "10:00")];
    const entries = mergeAdminAgendaItems(appointments, [block("b1", "2026-11-03", "09:00", "10:00")], false);
    assert.deepEqual(entries.map(({kind, id}) => [kind, id]), [["appointment", "a1"]]);
});
