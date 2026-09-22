import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const sql = await readFile(new URL("../supabase/migrations/20260922000000_loyalty_card.sql", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("fidelidade usa data oficial e fuso fixos", () => { assert.match(sql, /date '2026-10-02'/); assert.match(sql, /America\/Sao_Paulo/); });
test("qualquer serviço exceto reparo é elegível", () => { assert.match(sql, /loyalty_is_repair/); assert.doesNotMatch(sql, /price_cents.*eligible/i); });
test("reparo não reserva nem consome benefício", () => { assert.match(sql, /not public\.loyalty_is_repair/); assert.match(sql, /status='consumed'/); });
test("estrelas somente no completed e appointment é idempotente", () => { assert.match(sql, /new\.status='completed'/); assert.match(sql, /event_type='star-earned'/); });
test("penalidade usa períodos persistentes de 21 dias", () => { assert.match(sql, /periods := floor/); assert.match(sql, /loyalty_penalty_period_uidx/); });
test("gratuidade preserva preço e zera valor final", () => { assert.match(sql, /loyalty_original_price_cents/); assert.match(sql, /new\.price_cents := 0/); });
test("cancelamento devolve recompensa e completed consome", () => { assert.match(sql, /new\.status='cancelled'/); assert.match(sql, /status='available'/); assert.match(sql, /status='consumed'/); });
test("card fixo e regras aparecem na Central", () => { assert.match(app, /client-loyalty-card/); assert.match(app, /showLoyaltyRules/); assert.match(app, /A cada atendimento realizado/); });
test("preview visual explícito mostra 7/10 sem alterar o backend", () => { assert.match(app, /loyaltyPreview.*=== "1"/); assert.match(app, /stars: 7/); assert.match(app, /last_eligible_completed_at: "2026-10-01"/); assert.doesNotMatch(app, /loyaltyPreview[\s\S]{0,500}rpc/); });
test("botão Ver regras é compacto, sem ícone e não quebra linha", () => { assert.match(app, /Ver regras/); assert.match(app, /white-space: nowrap/); assert.match(app, /var\(--gradient-primary-action\)/); assert.doesNotMatch(app, />📖 Regras<\/button>/); });
