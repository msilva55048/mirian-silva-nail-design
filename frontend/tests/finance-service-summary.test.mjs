import assert from "node:assert/strict";
import {test} from "node:test";
import {summarizeFinanceServices} from "../src/features/admin/financeServiceGroups.ts";

const currentServices = [
    {name: "Esmaltação Premium", durationMinutes: 90},
    {name: "Reparo de Unha (Unitário)", durationMinutes: 20},
];

test("consolidação já existente da esmaltação permanece em um único card", () => {
    const summary = summarizeFinanceServices([
        {serviceName: "Esmaltação em Gel Básica", durationMinutes: 90, priceCents: 6000, isCompleted: true},
        {serviceName: "Esmaltação em Gel com Blindagem", durationMinutes: 90, priceCents: 7000, isCompleted: false},
    ], [{name: "Esmaltação em Gel com Blindagem", durationMinutes: 90}]);

    assert.equal(summary.length, 1);
    assert.equal(summary[0].serviceName, "Esmaltação em Gel com Blindagem");
    assert.equal(summary[0].completedCount, 1);
    assert.equal(summary[0].scheduledCount, 1);
});

test("renomeação e preço novo preservam o grupo consolidado e os valores históricos", () => {
    const summary = summarizeFinanceServices([
        {serviceName: "Esmaltação em Gel Básica", durationMinutes: 90, priceCents: 6000, isCompleted: true},
        {serviceName: "Esmaltação em Gel Básica com Blindagem", durationMinutes: 90, priceCents: 6500, isCompleted: true},
        {serviceName: "Esmaltação em Gel com Blindagem", durationMinutes: 90, priceCents: 7000, isCompleted: false},
        {serviceName: "Reparo de Unha (Unitário)", durationMinutes: 20, priceCents: 1000, isCompleted: false},
    ], currentServices);

    assert.deepEqual(summary, [
        {
            serviceName: "Esmaltação Premium",
            completedCount: 2,
            completedCents: 12500,
            scheduledCount: 1,
            scheduledCents: 7000,
        },
        {
            serviceName: "Reparo de Unha (Unitário)",
            completedCount: 0,
            completedCents: 0,
            scheduledCount: 1,
            scheduledCents: 1000,
        },
    ]);
});

test("serviços com a mesma duração não são agrupados fora do grupo de gel existente", () => {
    const summary = summarizeFinanceServices([
        {serviceName: "Esmaltação em Gel Básica", durationMinutes: 90, priceCents: 6000, isCompleted: true},
        {serviceName: "Outro serviço de 90 minutos", durationMinutes: 90, priceCents: 8000, isCompleted: false},
    ], currentServices);

    assert.deepEqual(summary, [
        {
            serviceName: "Outro serviço de 90 minutos",
            completedCount: 0,
            completedCents: 0,
            scheduledCount: 1,
            scheduledCents: 8000,
        },
        {
            serviceName: "Esmaltação Premium",
            completedCount: 1,
            completedCents: 6000,
            scheduledCount: 0,
            scheduledCents: 0,
        },
    ]);
});
