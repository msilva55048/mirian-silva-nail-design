import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20261014100000_qualify_referral_on_first_completed_service.sql', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

const shouldQualify = ({
  status,
  previousStatus,
  appointmentCreatedAt,
  referralCreatedAt,
  hasPriorCompletedSinceReferral = false,
  referralPending = true,
}) => status === 'completed'
  && previousStatus !== 'completed'
  && referralPending
  && appointmentCreatedAt >= referralCreatedAt
  && !hasPriorCompletedSinceReferral;

test('cadastro, agendamento futuro, cancelamento e reagendamento não liberam benefício', () => {
  for (const status of ['registered', 'pending', 'confirmed', 'cancelled']) {
    assert.equal(shouldQualify({status, previousStatus: null, appointmentCreatedAt: 20, referralCreatedAt: 10}), false);
  }
  assert.equal(shouldQualify({status: 'confirmed', previousStatus: 'pending', appointmentCreatedAt: 20, referralCreatedAt: 10}), false);
});

test('primeiro atendimento concluído após a indicação libera uma única vez', () => {
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'confirmed', appointmentCreatedAt: 20, referralCreatedAt: 10}), true);
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'completed', appointmentCreatedAt: 20, referralCreatedAt: 10}), false);
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'confirmed', appointmentCreatedAt: 20, referralCreatedAt: 10, referralPending: false}), false);
});

test('uma primeira reserva cancelada não impede que o próximo atendimento concluído qualifique', () => {
  assert.equal(shouldQualify({status: 'cancelled', previousStatus: 'confirmed', appointmentCreatedAt: 11, referralCreatedAt: 10}), false);
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'confirmed', appointmentCreatedAt: 20, referralCreatedAt: 10}), true);
});

test('restaurar pelo ADM de cancelado para concluído executa a mesma qualificação', () => {
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'cancelled', appointmentCreatedAt: 20, referralCreatedAt: 10}), true);
  assert.match(migration, /appointments_finalize_referral_reward/);
  assert.match(migration, /old\.status is distinct from 'completed'[\s\S]*?qualify_referral_after_completed_service/);
});

test('não libera para reserva criada antes da indicação nem duplica uma indicação já qualificada', () => {
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'confirmed', appointmentCreatedAt: 9, referralCreatedAt: 10}), false);
  assert.equal(shouldQualify({status: 'completed', previousStatus: 'confirmed', appointmentCreatedAt: 30, referralCreatedAt: 10, hasPriorCompletedSinceReferral: true}), false);
  assert.match(migration, /on conflict \(referral_id\) do nothing/i);
  assert.match(migration, /for update;/i);
});

test('conclusão depende do primeiro atendimento concluído, não do primeiro agendamento criado', () => {
  const finalizer = migration.match(/create or replace function public\.finalize_referral_reward_after_appointment\(\)([\s\S]*?)\$function\$;/)?.[1];
  assert.ok(finalizer, 'finalizador SQL presente');
  assert.match(finalizer, /qualify_referral_after_completed_service\(\s*new\.client_id,\s*new\.id/s);
  assert.doesNotMatch(finalizer, /new\.is_referred_first_appointment/);
  assert.match(migration, /referral-qualified:' \|\| v_qualified_referral_id::text/);
});

test('ADM e cliente veem atendimento concluído sem alegar que um benefício ausente já está disponível', () => {
  assert.match(migration, /a\.status = 'completed'[\s\S]*?a\.created_at >= cr\.created_at/);
  assert.match(migration, /create or replace function public\.get_admin_referrals/);
  assert.match(migration, /create or replace function public\.get_my_active_referrals/);
  assert.match(app, /referral\.reward_id \? <small>Desconto de/);
  assert.match(app, /Atendimento concluído; benefício pendente de regularização\./);
  assert.match(app, /Atendimento concluído; desconto pendente de regularização\./);
});

test('notificação de qualificação acompanha a criação única da recompensa, e eventos históricos de agendamento são preservados', () => {
  const capture = migration.match(/create or replace function public\.capture_client_appointment_notification\(\)([\s\S]*?)\$function\$;/)?.[1];
  assert.ok(capture, 'função de notificações existente substituída');
  assert.match(capture, /referral-scheduled/);
  assert.doesNotMatch(capture, /referral-qualified/);
  assert.match(migration, /'referral-qualified'/);
});
