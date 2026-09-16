import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const config = await readFile(new URL("../src/lib/pushConfig.ts", import.meta.url), "utf8");
const client = await readFile(new URL("../src/lib/clientPush.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../src/lib/adminPush.ts", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const adminFunction = await readFile(new URL("../supabase/functions/admin-web-push/index.ts", import.meta.url), "utf8");

test("suporte do navegador é independente da configuração VAPID", () => {
    const supportCheck = config.match(/export function isWebPushSupported\(\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    assert.match(supportCheck, /isSecureContext/);
    assert.match(supportCheck, /serviceWorker/);
    assert.match(supportCheck, /PushManager/);
    assert.match(supportCheck, /Notification/);
    assert.doesNotMatch(supportCheck, /vapid|hasWebPushConfiguration/);
    assert.match(config, /return Boolean\(vapidPublicKey\)/);
});

test("Cliente distingue sem suporte, erro de configuração, bloqueio e permissão default", () => {
    assert.match(client, /if \(!supported\(\)\) return "unsupported"/);
    assert.match(client, /if \(!hasWebPushConfiguration\(\)\) return "configuration-error"/);
    assert.match(client, /Notification\.permission === "denied"\) return "blocked"/);
    assert.match(client, /Notification\.permission !== "granted"\) return "inactive"/);
    assert.match(client, /if \(!hasWebPushConfiguration\(\)\) throw new Error\(webPushConfigurationError\)/);
    assert.match(app, /As notificações estão disponíveis, mas a configuração Web Push não está publicada\./);
});

test("ADM distingue sem suporte, erro de configuração, bloqueio e permissão default", () => {
    assert.match(admin, /if \(!isWebPushSupported\(\)\) return "unsupported"/);
    assert.match(admin, /if \(!hasWebPushConfiguration\(\)\) return "configuration-error"/);
    assert.match(admin, /Notification\.permission === "denied"\) return "blocked"/);
    assert.match(admin, /Notification\.permission !== "granted"\) return "disabled"/);
    assert.match(app, /Configuração Web Push indisponível\./);
});

test("Cliente e ADM reutilizam a subscription sem unsubscribe físico ao desativar um escopo", () => {
    assert.match(admin, /getSubscription\(\)/);
    assert.match(client, /getSubscription\(\)/);
    assert.doesNotMatch(admin.match(/export async function disableAdminPush\(\)[\s\S]*/)?.[0] ?? "", /subscription\.unsubscribe\(\)/);
    assert.doesNotMatch(client.match(/export async function disableClientPush\(\)[\s\S]*/)?.[0] ?? "", /subscription\.unsubscribe\(\)/);
});

test("ADM começa em loading e nunca transforma falha de status em falso desativado", () => {
    assert.match(app, /useState<AdminPushState>\("loading"\)/);
    assert.match(app, /setAdminPushState\("loading"\)/);
    assert.match(app, /setAdminPushState\("error"\)/);
    assert.doesNotMatch(app.match(/getAdminPushState\(\)\.then\([\s\S]*?async function loadAdminData/)?.[0] ?? "", /catch\(\(\) => setAdminPushState\("disabled"\)\)/);
    assert.match(app, /state !== "enabled"\) throw new Error\("O backend não confirmou a ativação neste aparelho\."\)/);
});

test("ADM aguarda Service Worker ativo e confirma o escopo no backend após ativação e desativação", () => {
    assert.match(admin, /await navigator\.serviceWorker\.ready/);
    assert.match(admin, /getRegistration\(\)/);
    assert.match(admin, /await isAdminSubscriptionRegistered\(subscription\)/);
    assert.match(admin, /backend ainda reconhece as notificações ADM como ativas/);
});

test("status ADMIN consulta o escopo do usuário autenticado pela subscription física", () => {
    const statusHandler = adminFunction.match(/if \(body\.action === "status"\) \{([\s\S]*?)\n    \}/)?.[1] ?? "";
    assert.match(statusHandler, /eq\("endpoint", endpoint\)\.eq\("admin_user_id", user\.id\)/);
    assert.match(statusHandler, /json\(\{registered: Boolean\(data\)\}, 200, headers\)/);
});
