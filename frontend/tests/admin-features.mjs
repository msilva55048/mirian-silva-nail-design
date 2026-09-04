// Teste isolado: TODAS as requisições externas são interceptadas. Nunca grava em produção.
// Uso: node tests/admin-features.mjs [caminho/para/playwright/index.mjs]
import assert from "node:assert/strict";
import {mkdirSync, readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const {chromium} = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const browser = await chromium.launch({channel: "msedge", headless: true});
const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"});
const page = await context.newPage();
mkdirSync(new URL("../node_modules/.cache/admin-features/", import.meta.url), {recursive: true});
page.setDefaultTimeout(10_000);
await page.clock.setFixedTime(new Date("2030-01-07T06:00:00-03:00"));
const apiUrl = process.env.ADMIN_TEST_SUPABASE_URL ??
    readFileSync(new URL("../.env", import.meta.url), "utf8")
        .match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1];
const storageKey = `sb-${new URL(apiUrl).hostname.split(".")[0]}-auth-token`;
const user = {id: "admin-test", email: "mirian201420@gmail.com", role: "authenticated", aud: "authenticated"};
const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub: user.id, exp: 2200000000, role: "authenticated"})).toString("base64url")}.test`;
await context.addInitScript(({storageKey, user, jwt}) => {
    localStorage.setItem(storageKey, JSON.stringify({access_token: jwt, refresh_token: "test-only", expires_at: 2200000000, expires_in: 3600, token_type: "bearer", user}));
}, {storageKey, user, jwt});
const profiles = ["Zélia", "Ana", "Maria Cancelada", "Maria Concluída", "Beatriz", "Carla Antiga", "Dora Ausente"].map((full_name, i) => ({id: `c${i}`, full_name, phone: `(48) 99999-000${i}`, email: null}));
const appointment = (clientIndex, status, date = "2030-01-07", time = "11:00") => ({id: `${clientIndex}-${status}-${date}-${time}`, client_id: `c${clientIndex}`, client_name: profiles[clientIndex].full_name, client_phone: profiles[clientIndex].phone, client_email: null, musical_taste: null, service_name: "Gel", appointment_date: date, start_time: time, duration_minutes: 60, price_cents: 6000, client_hidden: false, status, created_at: "2029-01-01T00:00:00Z"});
let appointments = [appointment(0, "confirmed"), appointment(0, "pending", "2030-01-08"), appointment(1, "pending", "2030-01-07", "13:00"), appointment(2, "cancelled"), appointment(3, "completed", "2029-01-01"), appointment(5, "pending", "2029-01-01"), appointment(6, "no-show")];
let entries = [];
let failBooking = false;
let failRemoval = false;
let rpcCalls = 0;
let lastRpc;
let entryCounter = 0;
const blocks = [{id: "block", block_date: "2030-01-07", start_time: "09:00", end_time: "10:00", reason: "Teste", created_at: "2029-01-01T00:00:00Z"}];
const calls = [];
const localUrl = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:5173";
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(localUrl).hostname));
let realtimeWaiting;
await context.routeWebSocket(/.*/, (socket) => {
    if (!socket.url().startsWith(apiUrl.replace("https:", "wss:") + "/realtime/")) return socket.close();
    socket.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        const array = Array.isArray(message);
        const [join_ref, ref, topic, event, payload] = array ? message : [message.join_ref, message.ref, message.topic, message.event, message.payload];
        const send = (event, payload, messageRef = ref) => socket.send(JSON.stringify(array ? [join_ref, messageRef, topic, event, payload] : {join_ref, ref: messageRef, topic, event, payload}));
        if (event === "phx_join") {
            const filters = (payload.config?.postgres_changes ?? []).map((filter, i) => ({...filter, id: i + 1}));
            send("phx_reply", {status: "ok", response: {postgres_changes: filters}});
            if (topic === "realtime:admin-waiting-list") realtimeWaiting = (row) => send("postgres_changes", {ids: [1], data: {schema: "public", table: "waiting_list", type: "UPDATE", commit_timestamp: new Date().toISOString(), columns: [], record: row, old_record: {}, errors: null}}, null);
        } else if (event === "heartbeat" || event === "phx_leave") send("phx_reply", {status: "ok", response: {}});
    });
});
await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(localUrl).origin) return route.continue();
    if (url.origin !== apiUrl) return route.abort();
    const resource = url.pathname.split("/").at(-1);
    const method = request.method();
    calls.push(`${method} ${resource}`);
    const json = (body, status = 200) => route.fulfill({status, contentType: "application/json", body: JSON.stringify(body)});
    if (resource === "user") return json(user);
    if (resource === "client_profiles") return json(profiles);
    if (resource === "services") return json([{id: 1, name: "Gel", description: "Gel", duration_minutes: 60, price_cents: 6000, display_order: 1}, {id: 2, name: "Reparo", description: "Reparo", duration_minutes: 30, price_cents: 1000, display_order: 2}]);
    if (resource === "schedule_blocks") {
        if (method === "POST") {
            const inserted = request.postDataJSON().map((row, index) => ({...row, id: `added-block-${blocks.length + index}`, created_at: "2030-01-07T06:00:00Z"}));
            blocks.push(...inserted);
            return json(inserted);
        }
        return json(blocks);
    }
    if (resource === "appointments") {
        if (method === "PATCH") {
            const ids = url.searchParams.get("id") ?? "";
            appointments = appointments.map((row) => ids.includes(row.id) ? {...row, status: "completed"} : row);
        }
        return json(appointments);
    }
    if (resource === "waiting_list") {
        if (method === "POST") {
            const {client_id, preferred_date, preferred_time} = request.postDataJSON();
            if (entries.some((entry) => entry.client_id === client_id)) return json({code: "23505", message: "duplicate"}, 409);
            entries.push({id: `w${++entryCounter}`, client_id, preferred_date, preferred_time, created_at: `2030-01-07T06:00:0${entryCounter}Z`});
        }
        if (method === "DELETE") {
            if (failRemoval) return json({message: "simulated removal failure"}, 500);
            entries = entries.filter((entry) => `eq.${entry.id}` !== url.searchParams.get("id"));
        }
        return json(entries);
    }
    if (resource === "admin_create_client_appointment") {
        rpcCalls++;
        lastRpc = request.postDataJSON();
        if (failBooking) return json({message: "Falha simulada", code: "P0001"}, 400);
        const row = {...appointment(Number(lastRpc.p_client_profile_id.slice(1)), "confirmed", lastRpc.p_appointment_date, lastRpc.p_start_time), id: `created-${rpcCalls}`, service_name: lastRpc.p_service_name, duration_minutes: lastRpc.p_duration_minutes};
        appointments.push(row);
        return json([row]);
    }
    return json([]);
});
const openView = (name) => page.locator(".admin-dashboard-cards").getByRole("button", {name: new RegExp(`^${name} `)}).click();
const names = () => page.locator(".admin-clients__grid .admin-client-card h3").allTextContents();
const waitFor = async (check) => {for (let i = 0; i < 100; i++) {if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 50));} throw new Error("Condition timed out");};
const checkWidth = async (width) => {
    await page.setViewportSize({width, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}px`);
    for (const selector of [".admin-client-filters button", ".admin-waiting-list button", ".admin-waiting-list input", ".admin-waiting-booking", ".admin-waiting-booking button", ".admin-waiting-booking select"]) {
        const bounds = await page.locator(`${selector}:visible`).evaluateAll((items) => items.map((item) => {const rect = item.getBoundingClientRect(); return {left: rect.left, right: rect.right};}));
        assert(bounds.every((rect) => rect.left >= 0 && rect.right <= width + 1), `${selector} outside ${width}px`);
    }
    if (width === 375 && await page.locator(".admin-waiting-list__preferences").count()) await page.locator(".admin-waiting-list__preferences").screenshot({path: "node_modules/.cache/admin-features/preferences-375.png"});
    if (width === 375) await page.screenshot({path: `node_modules/.cache/admin-features/${await page.locator(".admin-waiting-booking").count() ? "booking" : await page.locator(".admin-waiting-list").count() ? "waiting" : "filters"}-375.png`, fullPage: true});
};
try {
    await page.goto(`${localUrl}/admin`);
    await openView("Clientes");
    await waitFor(async () => (await names()).length === 7);
    const count = () => page.locator(".admin-clients__count").innerText();
    assert.match(await count(), /7\s*clientes cadastradas/);
    const beforeFilterCalls = calls.length;
    await page.getByRole("button", {name: "Clientes com agendamento", exact: true}).click();
    assert.deepEqual(await names(), ["Ana", "Zélia"]);
    assert.match(await count(), /2\s*clientes com agendamento/);
    await page.getByLabel("Buscar cliente", {exact: true}).fill("Zé");
    assert.deepEqual(await names(), ["Zélia"]);
    assert.match(await count(), /2\s*clientes com agendamento/);
    await page.getByLabel("Buscar cliente", {exact: true}).fill("0001");
    assert.deepEqual(await names(), ["Ana"]);
    await page.getByRole("button", {name: "Clientes sem agendamento", exact: true}).click();
    assert.deepEqual(await names(), []);
    assert.match(await count(), /5\s*clientes sem agendamento/);
    await page.getByLabel("Buscar cliente", {exact: true}).fill("");
    assert.deepEqual(await names(), ["Beatriz", "Carla Antiga", "Dora Ausente", "Maria Cancelada", "Maria Concluída"]);
    await page.getByLabel("Buscar cliente", {exact: true}).fill("Maria");
    assert.deepEqual(await names(), ["Maria Cancelada", "Maria Concluída"]);
    assert.match(await count(), /5\s*clientes sem agendamento/);
    await page.getByRole("button", {name: "Clientes sem agendamento", exact: true}).click();
    assert.match(await count(), /7\s*clientes cadastradas/);
    assert.equal(calls.length, beforeFilterCalls, "filters/counts must not query Supabase");
    for (const width of [375, 390, 430, 1280]) await checkWidth(width);
    console.log("PASS: active statuses, history, duplicates, A-Z, name/phone search, zero filter queries, four widths");
    await openView("Lista de espera");
    const add = async (name, date = "2030-01-07", time = "08:00") => {
        await page.getByLabel("Adicionar cliente à lista de espera").fill(name);
        await page.locator(".admin-waiting-list__results").getByRole("button").first().click();
        assert.match(await page.locator(".admin-waiting-list .admin-selected-client").innerText(), /Cliente selecionada/i);
        assert.equal(await page.getByLabel("Adicionar cliente à lista de espera").inputValue(), name);
        await page.locator(".admin-waiting-list .admin-selected-client").getByRole("button", {name: "Trocar", exact: true}).click();
        assert.equal(await page.getByLabel("Adicionar cliente à lista de espera").inputValue(), "");
        assert.equal(await page.locator(".admin-waiting-list .admin-selected-client").count(), 0);
        await page.getByLabel("Adicionar cliente à lista de espera").fill(name);
        await page.locator(".admin-waiting-list__results").getByRole("button").first().click();
        const calendar = page.getByRole("region", {name: "Data de interesse", exact: true});
        assert.equal(await page.locator('.admin-waiting-list input[type="date"], .admin-waiting-list input[type="time"]').count(), 0);
        await calendar.getByRole("button", {name: "Próximo mês", exact: true}).click();
        await calendar.getByRole("button", {name: "Mês anterior", exact: true}).click();
        assert(await calendar.getByRole("button", {name: "06/01/2030", exact: true}).isDisabled());
        await calendar.getByRole("button", {name: date.split("-").reverse().join("/"), exact: true}).click();
        await page.getByRole("region", {name: "Horário de interesse", exact: true}).getByRole("button", {name: time, exact: true}).click();
        assert.equal(await calendar.getByRole("button", {name: date.split("-").reverse().join("/"), exact: true}).getAttribute("aria-pressed"), "true");
        for (const width of [375, 390, 430, 1280]) await checkWidth(width);
        await page.getByRole("button", {name: "Adicionar à lista de espera", exact: true}).click();
    };
    await add("Beatriz");
    await waitFor(() => entries.length === 1);
    assert.equal(entries[0].preferred_date, "2030-01-07");
    assert.equal(entries[0].preferred_time, "08:00");
    assert.equal(rpcCalls, 0, "preference must not book");
    assert.equal(blocks.length, 1, "preference must not block");
    await waitFor(async () => await page.getByLabel("Adicionar cliente à lista de espera").inputValue() === "");
    await add("Beatriz");
    await page.getByText("Esta cliente já está na lista de espera.", {exact: true}).waitFor();
    assert.equal(entries.length, 1);
    await page.getByLabel("Adicionar cliente à lista de espera").fill("");
    await add("Ana", "2030-01-07", "09:00");
    await waitFor(() => entries.length === 2);
    await page.reload();
    await openView("Lista de espera");
    await waitFor(async () => await page.locator(".admin-waiting-list__identity strong").count() === 2);
    assert.deepEqual(await page.locator(".admin-waiting-list__identity strong").allTextContents(), ["Beatriz", "Ana"]);
    for (const width of [375, 390, 430, 1280]) await checkWidth(width);
    assert.match(await page.locator(".admin-waiting-list__entries").innerText(), /Data de interesse: 07\/01\/2030/);
    assert.match(await page.locator(".admin-waiting-list__entries").innerText(), /Horário de interesse: 08:00/);
    await waitFor(() => Boolean(realtimeWaiting));
    entries[0].preferred_date = "2030-01-08";
    realtimeWaiting(entries[0]);
    await page.getByText("Data de interesse: 08/01/2030", {exact: true}).waitFor();
    const bookFirst = () => page.locator(".admin-waiting-list__entries").getByRole("button", {name: "Agendar", exact: true}).first().click();
    await bookFirst();
    assert.match(await page.locator(".admin-selected-client").innerText(), /Beatriz/);
    await waitFor(async () => await page.locator(".admin-manual-times button.is-selected").innerText() === "08:00");
    assert.match(await page.locator(".admin-manual-booking__summary").innerText(), /08\/01\/2030/);
    assert.equal(await page.getByRole("button", {name: "Trocar", exact: true}).isVisible(), false);
    await page.getByRole("button", {name: "Cancelar", exact: true}).click();
    assert.equal(entries.length, 2);
    assert.equal(rpcCalls, 0);
    entries[0].preferred_date = "2030-01-07";
    realtimeWaiting(entries[0]);
    await page.getByText("Data de interesse: 08/01/2030", {exact: true}).waitFor({state: "hidden"});
    await bookFirst();
    for (const width of [375, 390, 430, 1280]) await checkWidth(width);
    const waitingTimes = await page.locator(".admin-manual-times button").allTextContents();
    assert(!waitingTimes.includes("11:00"), "occupied start must be unavailable");
    assert(!waitingTimes.includes("10:30"), "service must not invade an existing appointment");
    assert(!waitingTimes.includes("09:00"), "fully blocked start must be unavailable");
    assert(!waitingTimes.includes("09:30"), "partial overlap with a block must be unavailable");
    assert(!waitingTimes.includes("08:30"), "service duration must not invade a later block");
    assert(waitingTimes.includes("08:00"), "ending exactly when a block starts must be allowed");
    assert(waitingTimes.includes("10:00"), "starting exactly when a block ends must be allowed");
    assert(waitingTimes.includes("07:00"), "free time must remain available");
    await page.getByRole("button", {name: "Cancelar", exact: true}).click();
    await openView("Novo agendamento");
    assert.deepEqual(await page.locator(".admin-manual-times button").allTextContents(), waitingTimes, "same availability in both flows");
    console.log("PASS: both flows share availability; full/partial blocks, duration overlap, boundaries and existing appointments respected");
    await openView("Lista de espera");
    await bookFirst();
    await page.locator(".admin-manual-month-calendar__grid").getByRole("button", {name: "8", exact: true}).click();
    assert.match(await page.locator(".admin-manual-booking__summary").innerText(), /08\/01\/2030/);
    await page.locator(".admin-manual-month-calendar__grid").getByRole("button", {name: "7", exact: true}).click();
    await page.locator(".admin-manual-booking__service").selectOption("Reparo");
    assert(await page.locator(".admin-manual-times").getByRole("button", {name: "08:30", exact: true}).isVisible(), "shorter service fits before the block");
    await page.locator(".admin-manual-times").getByRole("button", {name: "08:30", exact: true}).click();
    await page.locator(".admin-manual-booking__service").selectOption("Gel");
    assert.equal(await page.locator(".admin-manual-times").getByRole("button", {name: "08:30", exact: true}).count(), 0, "blocked selection must not be reinserted by manualDisplayedTimes");
    assert(await page.getByRole("button", {name: "Salvar agendamento", exact: true}).isDisabled(), "longer service invalidates the selection");
    await page.locator(".admin-manual-booking__service").selectOption("Reparo");
    await page.locator(".admin-manual-times").getByRole("button", {name: "07:00", exact: true}).click();
    failBooking = true;
    await page.getByRole("button", {name: "Salvar agendamento", exact: true}).click();
    await page.locator(".admin-manual-form__error").filter({hasText: "Falha simulada"}).waitFor();
    assert.equal(entries.length, 2);
    failBooking = false;
    await page.getByRole("button", {name: "Salvar agendamento", exact: true}).click();
    await waitFor(() => entries.length === 1);
    await page.getByText(/Cliente removida da lista de espera/).waitFor();
    assert.equal(lastRpc.p_client_profile_id, "c4");
    assert.equal(lastRpc.p_service_name, "Reparo");
    assert.equal(lastRpc.p_duration_minutes, 30);
    assert.equal(lastRpc.p_appointment_date, "2030-01-07");
    assert.equal(lastRpc.p_start_time, "07:00");
    assert.equal(appointments.filter((row) => row.id.startsWith("created-")).length, 1);
    await bookFirst();
    assert.equal(await page.locator(".admin-manual-times button.is-selected").count(), 0, "blocked preference not selected");
    assert(await page.getByRole("button", {name: "Salvar agendamento", exact: true}).isDisabled());
    await page.locator(".admin-manual-times").getByRole("button", {name: "08:00", exact: true}).click();
    failRemoval = true;
    await page.getByRole("button", {name: "Salvar agendamento", exact: true}).click();
    await page.getByText(/não agende novamente/).waitFor();
    assert.equal(entries.length, 1);
    assert.equal(await page.locator("#admin-shared-booking").count(), 0);
    failRemoval = false;
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", {name: "Remover da lista", exact: true}).click();
    await waitFor(() => entries.length === 0);
    assert.equal(profiles.length, 7);
    console.log("PASS: add, duplicate rejection, reload persistence, FIFO, cancel, prefilled client, service, save failure, success cleanup, cleanup failure, manual removal");
    await openView("Novo agendamento");
    await page.getByPlaceholder("Buscar por nome ou telefone", {exact: true}).fill("Beatriz");
    await page.locator(".admin-client-picker__results").getByRole("button").first().click();
    await page.locator(".admin-manual-times").getByRole("button", {name: "17:00", exact: true}).click();
    await openView("Bloquear horários");
    await page.locator(".admin-block-times").getByRole("button", {name: "17:00", exact: true}).click();
    await page.getByRole("button", {name: "Bloquear selecionados", exact: true}).click();
    await waitFor(() => blocks.length === 2);
    await page.locator(".admin-block-list").getByText("17:00–17:30", {exact: true}).waitFor();
    await openView("Novo agendamento");
    assert.equal(await page.locator(".admin-manual-times").getByRole("button", {name: "17:00", exact: true}).count(), 0);
    const callsBeforeBlockedSave = rpcCalls;
    await page.getByRole("button", {name: "Salvar agendamento", exact: true}).click();
    await page.locator(".admin-manual-form__error").filter({hasText: "bloqueio de horário"}).waitFor();
    assert.equal(rpcCalls, callsBeforeBlockedSave, "stale selected time must be refused before the RPC");
    console.log("PASS: newly added block removes a stale selection from the grid and prevents submission");
    entries.push({id: "legacy", client_id: "c6", created_at: "2030-01-07T10:00:00Z", preferred_date: null, preferred_time: null});
    realtimeWaiting(entries[0]);
    await openView("Lista de espera");
    await page.getByText("Data de interesse: Não informada", {exact: true}).waitFor();
    await page.getByText("Horário de interesse: Não informado", {exact: true}).waitFor();
    await bookFirst();
    assert.equal(await page.locator(".admin-manual-times button.is-selected").count(), 0);
    await page.getByRole("button", {name: "Cancelar", exact: true}).click();
    assert.equal(entries.length, 1);
    console.log("PASS: category counters independent of search, preferences persistence/display/prefill, simulated Realtime, legacy nullable fields");
    console.log("All network traffic mocked; no real database writes. RLS/migration require a staging database.");
} finally {
    await browser.close();
}
