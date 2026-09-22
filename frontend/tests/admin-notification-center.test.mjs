import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
const adminPush = await readFile(new URL("../src/lib/adminPush.ts", import.meta.url), "utf8");
const clientPush = await readFile(new URL("../src/lib/clientPush.ts", import.meta.url), "utf8");
const edgePush = await readFile(new URL("../supabase/functions/admin-web-push/index.ts", import.meta.url), "utf8");

test("sino ADM abre a Central sem alterar subscription", () => {
  assert.match(app, /onClick=\{openAdminNotifications\}[\s\S]*?aria-label="Abrir Central de Notificações"/);
  assert.match(app, /adminNotificationsTriggerRef[\s\S]*?setShowAdminNotifications\(true\)/);
  assert.match(app, /function openAdminNotifications\(\)[\s\S]*?getAdminPushState\(\)/);
  assert.match(app, /role="dialog" aria-modal="true" aria-labelledby="admin-notifications-title"/);
  assert.match(app, /aria-label="Fechar Central de Notificações"/);
  assert.match(app, /event\.key !== "Escape"/);
  assert.match(app, /Nenhuma notificação por enquanto\./);
});

test("Central usa shell modal compartilhado e mantém seus cards dourados e responsivos", () => {
  assert.match(styles, /\.client-modal-backdrop\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*display:\s*grid;/);
  assert.match(styles, /\.client-modal\.client-notifications-modal\s*\{[^}]*border:\s*1px solid var\(--color-gold-border\)/);
  assert.match(styles, /\.client-notification-push-control\s*\{[^}]*display:\s*flex;[^}]*border:\s*1px solid var\(--color-gold-border\)/);
  assert.match(styles, /\.admin-notifications-modal \.client-notifications-list > \.client-account__empty\s*\{[^}]*place-items:\s*center/);
  assert.match(styles, /@media \(max-width:\s*560px\)/);
});

test("controle ADM usa serviço e estado real da subscription ADM", () => {
  assert.match(app, /aria-checked=\{adminPushState === "enabled"\}/);
  assert.match(app, /onClick=\{\(\) => void toggleAdminPush\(\)\}/);
  assert.match(adminPush, /invoke\("admin-web-push"/);
  assert.match(adminPush, /sendSubscription\("status", subscription\)/);
  assert.match(adminPush, /sendSubscription\("unsubscribe", subscription\)/);
  assert.match(edgePush, /admin_push_subscriptions/);
});

test("escopos push de ADM e cliente continuam independentes", () => {
  assert.match(adminPush, /invoke\("admin-web-push"/);
  assert.match(clientPush, /invoke\("client-web-push"/);
  assert.doesNotMatch(adminPush, /client_push_subscriptions/);
  assert.doesNotMatch(clientPush, /admin_push_subscriptions/);
});

test("abrir a Central não cria histórico nem tipos de evento", () => {
  assert.doesNotMatch(app, /admin_notifications|admin_notification_history/);
  assert.doesNotMatch(app, /admin-notification-(?:created|cancelled|rescheduled)/);
});
