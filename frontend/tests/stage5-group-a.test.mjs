import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("toggle de pagamento mantém o resultado da expressão anterior para todos os valores", () => {
    const assignment = app.match(/const nextPaymentStatus = ([^;]+);/);
    assert.ok(assignment, "a expressão nextPaymentStatus deve continuar presente");
    assert.equal(assignment[1], "!appointment.is_paid", "a alteração deve permanecer estritamente mecânica");

    const currentExpression = new Function("appointment", `return ${assignment[1]};`);
    const originalExpression = (appointment) => !Boolean(appointment.is_paid);
    const values = [undefined, null, false, true, 0, 1, "", "paid", {}, []];
    for (const is_paid of values) {
        assert.equal(currentExpression({is_paid}), originalExpression({is_paid}), `resultado divergente para ${String(is_paid)}`);
    }
});
