import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const serviceWorker = await readFile(new URL("../public/push-sw.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const edgeFunction = await readFile(new URL("../supabase/functions/client-web-push/index.ts", import.meta.url), "utf8");
const adminPush = await readFile(new URL("../src/lib/adminPush.ts", import.meta.url), "utf8");
const clientPush = await readFile(new URL("../src/lib/clientPush.ts", import.meta.url), "utf8");

test("notification click navigates or opens the payload route", () => {
    assert.match(serviceWorker, /event\.notification\.close\(\)/);
    assert.match(serviceWorker, /event\.notification\.data\?\.url/);
    assert.match(serviceWorker, /existing\.navigate\(targetUrl\)/);
    assert.match(serviceWorker, /self\.clients\.openWindow\(targetUrl\)/);
});

test("mock reminder route renders the fixed test card", () => {
    assert.match(edgeFunction, /url: "\/client\/reminder\?mock=1"/);
    assert.match(app, /const shouldShowReminderModal = mockReminder/);
    assert.match(app, /client-reminder-overlay/);
    assert.match(app, /client-reminder-modal/);
    assert.match(app, /Passando para te lembrar do <strong>agendamento<\/strong> comigo daqui a pouco/);
    assert.match(app, /Esmaltação em Gel com Blindagem/);
    assert.match(app, /25\/12\/2026/);
    assert.match(app, /12:00/);
});

test("real reminder route remains authenticated and appointment-bound", () => {
    assert.match(app, /reminderAppointmentId && clientUserId && clientProfile && reminderAppointment/);
    assert.match(edgeFunction, /appointment_id=\$\{encodeURIComponent\(appointment\.id\)\}/);
});

test("admin and client scopes reuse the browser subscription independently", () => {
    assert.match(adminPush, /getSubscription\(\)/);
    assert.match(clientPush, /getSubscription\(\)/);
    assert.match(adminPush, /sendSubscription\("status", subscription\)/);
    assert.doesNotMatch(adminPush.match(/export async function disableAdminPush\(\)[\s\S]*/)?.[0] ?? "", /subscription\.unsubscribe\(\)/);
    assert.doesNotMatch(clientPush.match(/export async function disableClientPush\(\)[\s\S]*/)?.[0] ?? "", /subscription\.unsubscribe\(\)/);
    assert.match(edgeFunction, /eq\("endpoint", endpoint\)\.eq\("client_id", clientId\)/);
});
