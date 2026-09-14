import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getConfiguredAdminStartMinutes} from '../src/shared/domain.ts';
import {hasScheduleBlockConflict} from '../src/features/admin/scheduleBlockConflicts.ts';

const date = '2030-01-07';

test('ADM preserva sua grade e overrides próprios', () => {
  const expected = [...Array.from({length: 13}, (_, index) => 420 + index * 30), ...Array.from({length: 9}, (_, index) => 1020 + index * 30)];
  assert.deepEqual(getConfiguredAdminStartMinutes(date), expected);
  assert.deepEqual(getConfiguredAdminStartMinutes(date, [{override_date: date, start_time: '10:00', is_available: true}, {override_date: date, start_time: '11:00', is_available: false}]), expected.filter((time) => time !== 660));
});

test('ADM detecta conflitos de bloqueio por duração', () => {
  const block = [{block_date: date, start_time: '09:30', end_time: '10:30'}];
  assert.equal(hasScheduleBlockConflict(block, date, '10:00', 60), true);
  assert.equal(hasScheduleBlockConflict(block, date, '10:30', 30), false);
});

test('ADM não herda a regra especial pública das 13:00', () => {
  assert.ok(getConfiguredAdminStartMinutes(date).includes(780));
});
