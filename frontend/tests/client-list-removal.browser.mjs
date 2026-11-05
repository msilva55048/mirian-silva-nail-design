// Browser test with all Supabase HTTP/Realtime traffic intercepted; never writes to production.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const {chromium} = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "playwright");
const browser = await chromium.launch({channel: "msedge", headless: true});
const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: "block"});
const page = await context.newPage();
page.setDefaultTimeout(10000);
await page.clock.setFixedTime(new Date("2030-01-07T06:00:00-03:00"));
const apiUrl = process.env.ADMIN_TEST_SUPABASE_URL ?? readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1];
const storageKey = `sb-${new URL(apiUrl).hostname.split(".")[0]}-auth-token`;
const user = {id: "admin-test", email: "mirian201420@gmail.com", role: "authenticated", aud: "authenticated"};
const jwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub: user.id, exp: 2200000000, role: "authenticated"})).toString("base64url")}.test`;
await context.addInitScript(({storageKey, user, jwt}) => {
    localStorage.setItem(storageKey, JSON.stringify({access_token: jwt, refresh_token: "test-only", expires_at: 2200000000, expires_in: 3600, token_type: "bearer", user}));
}, {storageKey, user, jwt});

const profiles = [
    {id: "c0", full_name: "Teste Sem Agendamentos", phone: "(48) 99999-0000", email: null, admin_hidden_at: null},
    {id: "c1", full_name: "Teste Histórico", phone: "(48) 99999-0001", email: null, admin_hidden_at: null},
    {id: "c2", full_name: "Teste Atendimento Ativo", phone: "(48) 99999-0002", email: null, admin_hidden_at: null},
];
const appointments = [
    {id: "a-history", client_id: "c1", client_name: profiles[1].full_name, client_phone: profiles[1].phone, client_email: null, musical_taste: null, service_name: "Gel", appointment_date: "2029-01-01", start_time: "10:00", duration_minutes: 60, price_cents: 8500, client_hidden: false, status: "completed", created_at: "2029-01-01T12:00:00Z"},
    {id: "a-active", client_id: "c2", client_name: profiles[2].full_name, client_phone: profiles[2].phone, client_email: null, musical_taste: null, service_name: "Gel", appointment_date: "2030-01-07", start_time: "12:00", duration_minutes: 60, price_cents: 12000, client_hidden: false, status: "confirmed", created_at: "2029-12-20T12:00:00Z"},
];
const originalAppointments = structuredClone(appointments);
const originalFinancialTotal = appointments.reduce((total, appointment) => total + appointment.price_cents, 0);
let zeroProfileUpdate = false;
let realtimeProfileUpdates = 0;
let realtimeClientProfiles;
let realtimeAppointments;
const localUrl = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:5190";
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(localUrl).hostname));

await context.routeWebSocket(/.*/, (socket) => {
    if (!socket.url().startsWith(apiUrl.replace("https:", "wss:") + "/realtime/")) return socket.close();
    socket.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        const isArray = Array.isArray(message);
        const [joinRef, ref, topic, event, payload] = isArray ? message : [message.join_ref, message.ref, message.topic, message.event, message.payload];
        const send = (replyEvent, replyPayload, messageRef = ref) => socket.send(JSON.stringify(isArray ? [joinRef, messageRef, topic, replyEvent, replyPayload] : {join_ref: joinRef, ref: messageRef, topic, event: replyEvent, payload: replyPayload}));
        if (event === "phx_join") {
            const filters = (payload.config?.postgres_changes ?? []).map((filter, index) => ({...filter, id: index + 1}));
            send("phx_reply", {status: "ok", response: {postgres_changes: filters}});
            if (topic === "realtime:admin-client-profiles-updates") realtimeClientProfiles = (row) => {realtimeProfileUpdates++; send("postgres_changes", {ids: [filters[0]?.id ?? 1], data: {schema: "public", table: "client_profiles", type: "UPDATE", commit_timestamp: new Date().toISOString(), columns: [], record: row, old_record: {}, errors: null}}, null);};
            if (topic === "realtime:admin-appointments-updates") realtimeAppointments = (row) => send("postgres_changes", {ids: [filters[0]?.id ?? 1], data: {schema: "public", table: "appointments", type: "INSERT", commit_timestamp: new Date().toISOString(), columns: [], record: row, old_record: {}, errors: null}}, null);
        } else if (event === "heartbeat" || event === "phx_leave") {
            send("phx_reply", {status: "ok", response: {}});
        }
    });
});

await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(localUrl).origin) return route.continue();
    if (url.origin !== apiUrl) return route.abort();
    const resource = url.pathname.split("/").at(-1);
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({status, contentType: "application/json", headers: {"Access-Control-Allow-Origin": new URL(localUrl).origin, "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"}, body: JSON.stringify(body)});
    if (method === "OPTIONS") return route.fulfill({status: 204, headers: {"Access-Control-Allow-Origin": new URL(localUrl).origin, "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"}});
    if (resource === "user") return json(user);
    if (resource === "client_profiles") {
        if (method === "PATCH") {
            if (zeroProfileUpdate) return json([]);
            const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
            const profile = profiles.find((item) => item.id === id);
            if (!profile) return json([]);
            Object.assign(profile, request.postDataJSON());
            realtimeClientProfiles?.(profile);
            return json([{id: profile.id, admin_hidden_at: profile.admin_hidden_at}]);
        }
        return json(profiles);
    }
    if (resource === "appointments") return json(appointments);
    if (resource === "services" || resource === "schedule_blocks" || resource === "schedule_time_overrides") return json([]);
    return json([]);
});

const openView = (name) => page.locator(".admin-dashboard-cards").getByRole("button", {name: new RegExp(`^${name} `)}).click();
const names = () => page.locator(".admin-clients__grid .admin-client-card h3").allTextContents();
const waitFor = async (condition) => {for (let attempt = 0; attempt < 100; attempt++) {if (await condition()) return; await new Promise((resolve) => setTimeout(resolve, 50));} throw new Error("Condition timed out");};

try {
    await page.goto(`${localUrl}/admin`);
    await openView("Clientes");
    await waitFor(async () => (await names()).length === 3);
    const expandClient = async (name) => {
        const card = page.locator(".admin-client-card").filter({has: page.getByRole("heading", {name, exact: true})});
        if (await card.getAttribute("aria-expanded") !== "true") await card.click();
        return card;
    };

    let emptyClient = await expandClient("Teste Sem Agendamentos");
    const patchCountBeforeCancel = realtimeProfileUpdates;
    page.once("dialog", (dialog) => dialog.dismiss());
    await emptyClient.getByRole("button", {name: "Remover da lista", exact: true}).click();
    assert((await names()).includes("Teste Sem Agendamentos"), "cancel leaves the profile visible");
    assert.equal(realtimeProfileUpdates, patchCountBeforeCancel, "cancel does not update Supabase");

    zeroProfileUpdate = true;
    page.once("dialog", (dialog) => dialog.accept());
    await emptyClient.getByRole("button", {name: "Remover da lista", exact: true}).click();
    await page.getByText(/Nenhum cadastro foi atualizado/, {exact: false}).waitFor();
    assert((await names()).includes("Teste Sem Agendamentos"), "a zero-row RLS response is reported and leaves local state unchanged");

    zeroProfileUpdate = false;
    const eventsBeforeRemove = realtimeProfileUpdates;
    page.once("dialog", (dialog) => dialog.accept());
    await emptyClient.getByRole("button", {name: "Remover da lista", exact: true}).click();
    await waitFor(async () => !(await names()).includes("Teste Sem Agendamentos"));
    await waitFor(() => realtimeProfileUpdates > eventsBeforeRemove);
    assert(profiles[0].admin_hidden_at, "profile has a persisted removal marker");
    assert.deepEqual(appointments, originalAppointments, "removing a profile without appointments changes no appointment rows");

    await page.reload();
    await openView("Clientes");
    await waitFor(async () => !(await names()).includes("Teste Sem Agendamentos"));

    const historyBefore = structuredClone(appointments.find((item) => item.client_id === "c1"));
    const historyClient = await expandClient("Teste Histórico");
    page.once("dialog", (dialog) => dialog.accept());
    await historyClient.getByRole("button", {name: "Remover da lista", exact: true}).click();
    await waitFor(async () => !(await names()).includes("Teste Histórico"));
    assert.deepEqual(appointments.find((item) => item.client_id === "c1"), historyBefore, "history and financial data remain untouched");

    await page.reload();
    await openView("Clientes");
    await waitFor(async () => !(await names()).includes("Teste Histórico"));
    await openView("Financeiro");
    const financeTotalSelector = ".admin-finance-service-card__row--total";
    await page.locator(financeTotalSelector).first().waitFor();
    const financeTotalBeforeRemoval = await page.locator(financeTotalSelector).first().innerText();
    await openView("Clientes");
    const activeBefore = structuredClone(appointments.find((item) => item.client_id === "c2"));
    const activeClient = await expandClient("Teste Atendimento Ativo");
    page.once("dialog", (dialog) => dialog.accept());
    await activeClient.getByRole("button", {name: "Remover da lista", exact: true}).click();
    await waitFor(async () => !(await names()).includes("Teste Atendimento Ativo"));
    assert.deepEqual(appointments.find((item) => item.client_id === "c2"), activeBefore, "active appointment stays intact");
    await openView("Agendamentos");
    await page.getByText("Teste Atendimento Ativo", {exact: true}).waitFor();
    assert.equal(appointments.reduce((sum, item) => sum + item.price_cents, 0), originalFinancialTotal, "financial total is unchanged");
    await openView("Financeiro");
    assert.equal(await page.locator(financeTotalSelector).first().innerText(), financeTotalBeforeRemoval, "the financial total shown in the admin screen stays unchanged");

    const marker = profiles[0].admin_hidden_at;
    const newAppointment = {id: "a-new", client_id: "c0", client_name: profiles[0].full_name, client_phone: profiles[0].phone, client_email: null, musical_taste: null, service_name: "Gel", appointment_date: "2030-01-07", start_time: "14:00", duration_minutes: 60, price_cents: 6000, client_hidden: false, status: "confirmed", created_at: new Date(Date.parse(marker) + 1000).toISOString()};
    appointments.push(newAppointment);
    realtimeAppointments?.(newAppointment);
    await openView("Clientes");
    await waitFor(async () => (await names()).includes("Teste Sem Agendamentos"));
    assert.equal(profiles[0].admin_hidden_at, marker, "the new appointment restores visibility without deleting removal history");

    console.log("PASS: confirmation cancel, zero-row RLS response, persisted profile removal, Realtime, reload, history and active appointment preservation, unchanged finance total, and reappearance on new booking");
} finally {
    await browser.close();
}
