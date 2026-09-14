import assert from "node:assert/strict";
import {test} from "node:test";
import {
    CONSOLIDATED_GEL_SERVICE_NAME,
    getFinanceServiceSummaryName,
    summarizeFinanceServices,
} from "../src/features/admin/financeServiceGroups.ts";

test("resumo financeiro consolida os nomes históricos da esmaltação em gel", () => {
    const names = [
        "Esmaltação em Gel Básica",
        "Esmaltação em Gel Básica com Blindagem",
        "Esmaltação em Gel com Blindagem",
        "Esmaltação em Gel wcom Blindagem",
    ];

    assert.deepEqual(
        names.map(getFinanceServiceSummaryName),
        Array(names.length).fill(CONSOLIDATED_GEL_SERVICE_NAME),
    );
});

test("reparo unitário permanece separado no resumo financeiro", () => {
    assert.equal(
        getFinanceServiceSummaryName("Reparo de Unha (Unitário)"),
        "Reparo de Unha (Unitário)",
    );
});

test("card consolidado soma quantidades e valores sem alterar o reparo", () => {
    const summary = summarizeFinanceServices([
        {serviceName: "Esmaltação em Gel Básica", priceCents: 6000, isCompleted: true},
        {serviceName: "Esmaltação em Gel Básica com Blindagem", priceCents: 6500, isCompleted: true},
        {serviceName: "Esmaltação em Gel com Blindagem", priceCents: 7000, isCompleted: false},
        {serviceName: "Reparo de Unha (Unitário)", priceCents: 1000, isCompleted: false},
    ]);

    assert.deepEqual(summary, [
        {
            serviceName: CONSOLIDATED_GEL_SERVICE_NAME,
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
