import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import ts from "typescript";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const sharedWaitlist = await readFile(new URL("../src/features/admin/SharedWaitlist.tsx", import.meta.url), "utf8");

function parse(source, name) {
    return ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function findNode(sourceFile, predicate) {
    let found;
    function visit(node) {
        if (!found && predicate(node)) found = node;
        if (!found) ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    assert.ok(found, "expected source node was found");
    return found;
}

function compileExpression(node, parameters, values) {
    const javascript = ts.transpileModule(node.getText(), {
        compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None},
    }).outputText.trim().replace(/^"use strict";\s*/, "").replace(/;$/, "");
    return new Function(...parameters, `return (${javascript});`)(...values);
}

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return {promise, resolve};
}

function extractClientNotificationEffect(clientProfile, supabase, setClientNotifications) {
    const sourceFile = parse(app, "App.tsx");
    const effect = findNode(sourceFile, (node) => ts.isCallExpression(node)
        && ts.isIdentifier(node.expression) && node.expression.text === "useEffect"
        && node.getText().includes("client-notifications-"));
    return compileExpression(effect.arguments[0], ["clientProfile", "supabase", "setClientNotifications"], [clientProfile, supabase, setClientNotifications]);
}

function extractSharedWaitlistEffect(load, supabase) {
    const sourceFile = parse(sharedWaitlist, "SharedWaitlist.tsx");
    const effect = findNode(sourceFile, (node) => ts.isCallExpression(node)
        && ts.isIdentifier(node.expression) && node.expression.text === "useEffect"
        && node.getText().includes("shared-waitlist-admin"));
    return compileExpression(effect.arguments[0], ["load", "supabase"], [load, supabase]);
}

test("efeito da Central carrega, atualiza por Realtime e ignora resposta após cleanup", async () => {
    const pending = deferred();
    const updates = [];
    let realtime;
    let removed = false;
    const query = {select() { return this; }, order() { return this; }, limit() { return pending.promise; }};
    const supabase = {
        from(table) { assert.equal(table, "client_notifications"); return query; },
        channel(name) { assert.equal(name, "client-notifications-client-1"); return {
            on(_event, filter, callback) { assert.equal(filter.filter, "client_id=eq.client-1"); realtime = callback; return this; },
            subscribe() { return this; },
        }; },
        async removeChannel() { removed = true; },
    };
    const cleanup = extractClientNotificationEffect({id: "client-1"}, supabase, (value) => updates.push(value))();
    assert.equal(typeof realtime, "function");
    cleanup();
    pending.resolve({data: [{id: "stale"}], error: null});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(removed, true);
    assert.deepEqual(updates, []);
});

test("efeito da Central limpa sessão sem perfil e preserva lista em erro de rede", async () => {
    const cleared = [];
    extractClientNotificationEffect(null, {}, (value) => cleared.push(value))();
    assert.deepEqual(cleared, [[]]);

    const updates = [];
    const supabase = {
        from() { return {select() { return this; }, order() { return this; }, limit: async () => ({data: null, error: {message: "network"}})}; },
        channel() { return {on() { return this; }, subscribe() { return this; }}; },
        async removeChannel() {},
    };
    const cleanup = extractClientNotificationEffect({id: "client-1"}, supabase, (value) => updates.push(value))();
    await new Promise((resolve) => setImmediate(resolve));
    cleanup();
    assert.deepEqual(updates, []);
});

test("efeito da Central atualiza após evento Realtime para a cliente autenticada", async () => {
    const results = [[{id: "initial"}], [{id: "realtime"}]];
    let realtime;
    const updates = [];
    const supabase = {
        from() { return {select() { return this; }, order() { return this; }, limit: async () => ({data: results.shift(), error: null})}; },
        channel() { return {on(_event, filter, callback) { assert.equal(filter.filter, "client_id=eq.client-2"); realtime = callback; return this; }, subscribe() { return this; }}; },
        async removeChannel() {},
    };
    const cleanup = extractClientNotificationEffect({id: "client-2"}, supabase, (value) => updates.push(value))();
    await new Promise((resolve) => setImmediate(resolve));
    realtime();
    await new Promise((resolve) => setImmediate(resolve));
    cleanup();
    assert.deepEqual(updates, [[{id: "initial"}], [{id: "realtime"}]]);
});

test("efeito Realtime da lista compartilhada mantém carga inicial, atualização e remoção do canal", async () => {
    const pending = deferred();
    let realtime;
    let removed = false;
    const loads = [];
    const supabase = {
        channel(name) { assert.equal(name, "shared-waitlist-admin"); return {
            on(_event, filter, callback) { assert.equal(filter.table, "waiting_list_requests"); realtime = callback; return this; },
            subscribe() { return this; },
        }; },
        async removeChannel() { removed = true; },
    };
    const load = () => { loads.push("called"); return pending.promise; };
    const cleanup = extractSharedWaitlistEffect(load, supabase)();
    assert.deepEqual(loads, ["called"]);
    realtime();
    assert.deepEqual(loads, ["called", "called"]);
    cleanup();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(removed, true);
});

test("sem perfil autenticado, a Central não mantém notificações anteriores", () => {
    const sourceFile = parse(app, "App.tsx");
    const effect = findNode(sourceFile, (node) => ts.isCallExpression(node)
        && ts.isIdentifier(node.expression) && node.expression.text === "useEffect"
        && node.getText().includes("client-notifications-"));
    assert.match(effect.getText(), /if \(!clientProfile\)[\s\S]*setClientNotifications\(\[\]\)/);
});

test("classificação temporal preserva limites, status, deduplicação e ordenação", () => {
    const sourceFile = parse(app, "App.tsx");
    const dueTypesDeclaration = findNode(sourceFile, (node) => ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name) && node.name.text === "getDueNotificationTypes");
    const getDueNotificationTypes = compileExpression(dueTypesDeclaration.initializer, ["useCallback", "notificationClock", "getAppointmentDateTime"], [(callback) => callback, 0, (appointment) => new Date(appointment.at)]);
    const getNotificationKey = (appointmentId, type) => `${appointmentId}:${type}`;
    const memoDeclaration = findNode(sourceFile, (node) => ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name) && node.name.text === "pendingWhatsAppNotifications");
    assert.ok(ts.isCallExpression(memoDeclaration.initializer));
    const getPending = compileExpression(memoDeclaration.initializer.arguments[0], ["appointments", "getDueNotificationTypes", "getNotificationKey", "getAppointmentDateTime"], [
        [
            {id: "later", status: "confirmed", at: 10 * 60 * 60 * 1000, confirmation_sent_at: null},
            {id: "earlier", status: "pending", at: 3 * 60 * 60 * 1000, confirmation_sent_at: null},
            {id: "boundary-low", status: "pending", at: 2 * 60 * 60 * 1000, confirmation_sent_at: null},
            {id: "boundary-high", status: "pending", at: 40 * 60 * 60 * 1000, confirmation_sent_at: null},
            {id: "sent", status: "confirmed", at: 4 * 60 * 60 * 1000, confirmation_sent_at: "2026-10-10T00:00:00Z"},
            {id: "cancelled", status: "cancelled", at: 4 * 60 * 60 * 1000, confirmation_sent_at: null},
        ],
        getDueNotificationTypes,
        getNotificationKey,
        (appointment) => new Date(appointment.at),
    ]);

    assert.deepEqual(getPending().map(({appointment, key}) => [appointment.id, key]), [
        ["earlier", "earlier:attendance-confirmation"],
        ["later", "later:attendance-confirmation"],
        ["boundary-high", "boundary-high:attendance-confirmation"],
    ]);
});
