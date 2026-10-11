import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import ts from "typescript";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findNode(predicate) {
    let result;
    function visit(node) {
        if (!result && predicate(node)) result = node;
        if (!result) ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    assert.ok(result, "expected code node not found");
    return result;
}

function transpile(source) {
    return ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None}}).outputText.replace(/^"use strict";\s*/, "");
}

function compileExpression(node, names, values) {
    const javascript = transpile(node.getText()).trim().replace(/;$/, "");
    return new Function(...names, `return (${javascript});`)(...values);
}

function createWindowHarness() {
    const intervals = [];
    const removedIntervals = [];
    const windowListeners = new Map();
    const documentListeners = new Map();
    return {
        intervals, removedIntervals, windowListeners, documentListeners,
        window: {
            setInterval(callback, milliseconds) { const timer = {callback, milliseconds}; intervals.push(timer); return timer; },
            clearInterval(timer) { removedIntervals.push(timer); },
            addEventListener(name, callback) { windowListeners.set(name, callback); },
            removeEventListener(name, callback) { if (windowListeners.get(name) === callback) windowListeners.delete(name); },
        },
        document: {
            visibilityState: "visible",
            addEventListener(name, callback) { documentListeners.set(name, callback); },
            removeEventListener(name, callback) { if (documentListeners.get(name) === callback) documentListeners.delete(name); },
        },
    };
}

function getAppointmentPollingEffect({clientProfile, clientAccountSection, loadClientAppointments, window, document}) {
    const effect = findNode((node) => ts.isCallExpression(node)
        && ts.isIdentifier(node.expression) && node.expression.text === "useEffect"
        && node.getText().includes("setInterval(refresh, 15000)"));
    const clientProfileId = clientProfile?.id;
    return compileExpression(effect.arguments[0], ["clientProfile", "clientProfileId", "clientAccountSection", "loadClientAppointments", "window", "document"], [clientProfile, clientProfileId, clientAccountSection, loadClientAppointments, window, document]);
}

test("dependências do polling usam o mesmo ID estável e a mesma seção", () => {
    const effect = findNode((node) => ts.isCallExpression(node)
        && ts.isIdentifier(node.expression) && node.expression.text === "useEffect"
        && node.getText().includes("setInterval(refresh, 15000)"));
    assert.equal(effect.arguments[1].getText(), "[clientProfileId, clientAccountSection]");
});

test("refresh de agendamentos mantém gatilhos, intervalo, validade de resposta e cleanup", () => {
    const browser = createWindowHarness();
    const requests = [];
    const loadClientAppointments = (clientId, isCurrent) => requests.push({clientId, isCurrent});
    const cleanup = getAppointmentPollingEffect({clientProfile: {id: "client-a"}, clientAccountSection: "appointments", loadClientAppointments, ...browser})();

    assert.deepEqual(requests.map(({clientId}) => clientId), ["client-a"]);
    assert.equal(browser.intervals.length, 1);
    assert.equal(browser.intervals[0].milliseconds, 15000);
    assert.equal(typeof browser.windowListeners.get("focus"), "function");
    assert.equal(typeof browser.documentListeners.get("visibilitychange"), "function");

    browser.windowListeners.get("focus")();
    browser.documentListeners.get("visibilitychange")();
    browser.intervals[0].callback();
    assert.deepEqual(requests.map(({clientId}) => clientId), ["client-a", "client-a", "client-a", "client-a"]);
    assert.equal(requests[0].isCurrent(), false);
    assert.equal(requests.at(-1).isCurrent(), true);

    browser.document.visibilityState = "hidden";
    browser.windowListeners.get("focus")();
    browser.documentListeners.get("visibilitychange")();
    browser.intervals[0].callback();
    assert.equal(requests.length, 4);

    cleanup();
    assert.deepEqual(browser.removedIntervals, [browser.intervals[0]]);
    assert.equal(browser.windowListeners.has("focus"), false);
    assert.equal(browser.documentListeners.has("visibilitychange"), false);
    assert.equal(requests.at(-1).isCurrent(), false);
});

test("refresh não inicia fora da seção de agendamentos ou sem perfil", () => {
    for (const props of [
        {clientProfile: {id: "client-a"}, clientAccountSection: "profile"},
        {clientProfile: null, clientAccountSection: "appointments"},
    ]) {
        const browser = createWindowHarness();
        const requests = [];
        const cleanup = getAppointmentPollingEffect({...props, loadClientAppointments: (...args) => requests.push(args), ...browser})();
        assert.deepEqual(requests, []);
        assert.equal(browser.intervals.length, 0);
        assert.equal(cleanup, undefined);
    }
});

test("troca de cliente invalida o pedido anterior e isola o refresh pelo novo ID", () => {
    const firstBrowser = createWindowHarness();
    const requests = [];
    const loadClientAppointments = (clientId, isCurrent) => requests.push({clientId, isCurrent});
    const cleanupFirst = getAppointmentPollingEffect({clientProfile: {id: "client-a"}, clientAccountSection: "appointments", loadClientAppointments, ...firstBrowser})();
    cleanupFirst();
    const secondBrowser = createWindowHarness();
    const cleanupSecond = getAppointmentPollingEffect({clientProfile: {id: "client-b"}, clientAccountSection: "appointments", loadClientAppointments, ...secondBrowser})();

    assert.deepEqual(requests.map(({clientId}) => clientId), ["client-a", "client-b"]);
    assert.equal(requests[0].isCurrent(), false);
    assert.equal(requests[1].isCurrent(), true);
    cleanupSecond();
});

function compileCurrentWeekDates() {
    const names = ["formatDateForInput", "parseLocalDate", "addDays", "startOfCalendarWeek", "getWeekDates"];
    const functions = names.map((name) => findNode((node) => ts.isFunctionDeclaration(node) && node.name?.text === name).getText());
    const javascript = transpile(functions.join("\n"));
    return new Function(`${javascript}; return getWeekDates;`)();
}

test("getWeekDates mantém segunda-feira, sete dias e viradas de mês/ano", () => {
    const getWeekDates = compileCurrentWeekDates();
    assert.deepEqual(getWeekDates("2026-03-01"), ["2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01"]);
    assert.deepEqual(getWeekDates("2026-03-02"), ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"]);
    assert.deepEqual(getWeekDates("2025-12-31"), ["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
});

test("getWeekDates preserva datas locais ao redor de mudanças de fuso/DST", () => {
    const originalTimezone = process.env.TZ;
    const getWeekDates = compileCurrentWeekDates();
    try {
        for (const timezone of ["UTC", "America/Sao_Paulo", "America/Los_Angeles"]) {
            process.env.TZ = timezone;
            assert.deepEqual(getWeekDates("2026-03-08"), ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08"], timezone);
            assert.deepEqual(getWeekDates("2026-11-01"), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"], timezone);
        }
    } finally {
        if (originalTimezone === undefined) delete process.env.TZ;
        else process.env.TZ = originalTimezone;
    }
});
