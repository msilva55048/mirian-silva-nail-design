import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260921220000_notification_delivery_improvements.sql", import.meta.url), "utf8");
const waitlistFunction = await readFile(new URL("../supabase/functions/waitlist-opportunity-push/index.ts", import.meta.url), "utf8");
const adminFunction = await readFile(new URL("../supabase/functions/admin-web-push/index.ts", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("lista de espera resolve Central sem exigir subscription física", () => {
    assert.match(migration, /get_waitlist_opportunity_notification_targets/);
    assert.match(migration, /join public\.waiting_list_requests/);
    assert.doesNotMatch(migration.match(/get_waitlist_opportunity_notification_targets\(\)[\s\S]*?\$\$;/)?.[0] ?? "", /client_id.*waitlist_opportunities/);
});

test("oportunidade cria uma notificação deduplicada por cliente", () => {
    assert.match(waitlistFunction, /p_type: "waitlist-opportunity"/);
    assert.match(waitlistFunction, /waitlist-opportunity:\$\{target\.opportunity_id\}:\$\{target\.client_id\}/);
    assert.match(waitlistFunction, /get_waitlist_opportunity_notification_targets/);
});

test("Central e pipeline próprio não duplicam Push da lista de espera", () => {
    assert.doesNotMatch(migration.match(/create or replace function public\.queue_client_notification_push[\s\S]*?\$function\$/)?.[0] ?? "", /waitlist-opportunity/);
    assert.match(waitlistFunction, /get_waitlist_opportunity_dispatch_targets/);
});

test("Push ADM possui dispatch independente por subscription", () => {
    assert.match(migration, /appointment_push_dispatches/);
    assert.match(migration, /unique \(event_id, subscription_id\)/);
    assert.match(adminFunction, /upsert\(\{event_id: event\.id, subscription_id: subscription\.id\}/);
});

test("Push ADM limita retry e separa falha transitória de subscription inválida", () => {
    assert.match(adminFunction, /retry < 3/);
    assert.match(adminFunction, /status: "invalid"/);
    assert.match(adminFunction, /status: "failed"/);
    assert.match(adminFunction, /processed_with_errors/);
});

test("eventos ADM antigos não são reprocessados pelo webhook", () => {
    assert.match(adminFunction, /eq\("status", "pending"\)/);
    assert.match(adminFunction, /if \(!event\) return json\(\{ok: true, duplicate: true\}/);
});

test("uso da recompensa gera notificação somente na transição reserved para used", () => {
    assert.match(migration, /status = 'used'/);
    assert.match(migration, /and status = 'reserved'/);
    assert.match(migration, /'referral-reward-used'/);
    assert.match(migration, /referral-reward-used:' \|\| new\.referral_reward_id/);
});

test("a Central já roteia os novos tipos para as áreas existentes", () => {
    assert.match(app, /notification\.type === "waitlist-opportunity"/);
    assert.match(app, /notification\.type\.startsWith\("referral-"\)/);
});
