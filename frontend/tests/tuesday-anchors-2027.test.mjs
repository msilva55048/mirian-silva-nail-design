import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getConfiguredClientStartMinutes} from '../src/shared/domain.ts';
import {getClientBookingStartContext, canServiceUseClientStart} from '../src/shared/dynamicSchedule.ts';
import {getAvailableClientStarts} from '../src/features/public/clientAvailability.ts';

const anchors = [510, 630, 810, 930, 1050, 1170];
const oldWeekday = [420, 540, 660, 780, 1020, 1140];
const override = (date, start_time, is_available = true) => ({override_date: date, start_time, is_available});
const appointment = (id, date, startTime, durationMinutes, status = 'confirmed') => ({
  id, date, startTime, durationMinutes, status,
  clientName: 'Cliente', clientPhone: '', clientEmail: '', serviceName: 'Esmaltação',
});

test('terças anteriores a 2027 preservam horários; terça em 2027 e posteriores usam seis âncoras', () => {
  assert.deepEqual(getConfiguredClientStartMinutes('2026-12-29'), oldWeekday);
  for (const date of ['2027-01-05', '2028-02-01', '2040-12-25']) {
    assert.deepEqual(getConfiguredClientStartMinutes(date), anchors, date);
  }
});

test('outros dias e overrides permanecem sob o limite específico das terças', () => {
  assert.deepEqual(getConfiguredClientStartMinutes('2027-01-06'), oldWeekday);
  assert.deepEqual(getConfiguredClientStartMinutes('2027-01-09'), [420, 540, 660, 780]);
  assert.deepEqual(getConfiguredClientStartMinutes('2027-01-05', [
    override('2027-01-05', '20:00'), override('2027-01-05', '19:30', false),
  ]), anchors.filter((start) => start !== 1170));
});

test('dinâmicos entre âncoras novas podem terminar exatamente na próxima e não podem atravessá-la', () => {
  const date = '2027-01-05';
  const c1 = getClientBookingStartContext(date, [appointment('a', date, '08:30', 60)]);
  assert.equal(c1.generatedStarts.includes(570), true);
  assert.equal(canServiceUseClientStart(570, 60, c1), true, '09:30–10:30 permitido');
  assert.equal(canServiceUseClientStart(570, 90, c1), false, '09:30–11:00 invade próxima âncora');

  const c2 = getClientBookingStartContext(date, [appointment('b', date, '08:30', 90)]);
  assert.equal(c2.generatedStarts.includes(600), true);
  assert.equal(canServiceUseClientStart(600, 30, c2), true, '10:00–10:30 permitido');
  assert.equal(canServiceUseClientStart(600, 60, c2), false, '10:00–11:00 invade próxima âncora');
});

test('13:30 e 15:30 são âncoras utilizáveis; dinâmicos param na próxima âncora', () => {
  const date = '2027-01-05';
  const c = getClientBookingStartContext(date, [appointment('c', date, '13:30', 60)]);
  assert.equal(canServiceUseClientStart(810, 120, c, 'Reparo de unha'), true);
  assert.equal(c.generatedStarts.includes(870), true);
  assert.equal(canServiceUseClientStart(870, 60, c), true, '14:30–15:30 permitido');
  assert.equal(canServiceUseClientStart(870, 90, c), false, '14:30–16:00 invade próxima âncora');
  assert.equal(canServiceUseClientStart(930, 120, c), true, '15:30 não herda a antiga restrição das 13:00');
});

test('última âncora permite terminar às 21:30, mas não amplia expediente além disso', () => {
  const date = '2027-01-05';
  const c = getClientBookingStartContext(date, []);
  assert.equal(canServiceUseClientStart(1170, 120, c), true, '19:30–21:30 permitido');
  assert.equal(canServiceUseClientStart(1170, 150, c), false, 'não ultrapassa 21:30');
  assert.equal(c.allStarts.some((start) => start > 1170), false, 'sem dinâmicos após última âncora');
  assert.equal(getConfiguredClientStartMinutes('2027-01-06', [override('2027-01-06', '19:30')]).includes(1170), false);
});

test('appointments e bloqueios existentes continuam indisponíveis nas novas terças', () => {
  const date = '2027-01-05';
  const starts = getAvailableClientStarts(date, 60,
    [appointment('existing', date, '08:30', 60)],
    [{id: 'block', date, startTime: '13:30', endTime: '14:30'}], [], 'Esmaltação');
  assert.equal(starts.includes(510), false, 'não sobrepõe appointment existente');
  assert.equal(starts.includes(810), false, 'respeita bloqueio existente');
});
