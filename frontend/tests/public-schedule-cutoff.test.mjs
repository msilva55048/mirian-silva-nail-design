import test from 'node:test';
import assert from 'node:assert/strict';

const baseStarts = (date) => {
  if (date >= '2026-10-21' && date <= '2026-10-26') return [];
  const day = new Date(`${date}T12:00:00`).getDay();
  if (day === 0 || day === 6) return [420, 540, 660, 780];
  if (date < '2026-10-02') return [420, 1170, 1260];
  return [420, 540, 660, 780, 1020, 1140];
};

test('01/10 preserves the legacy weekday grid', () => {
  assert.deepEqual(baseStarts('2026-10-01'), [420, 1170, 1260]);
});

test('02/10 starts the new client base grid', () => {
  assert.deepEqual(baseStarts('2026-10-02'), [420, 540, 660, 780, 1020, 1140]);
});

test('21/10 through 26/10 remain closed by the existing closure rule', () => {
  assert.deepEqual(baseStarts('2026-10-21'), []);
  assert.deepEqual(baseStarts('2026-10-26'), []);
});

test('27/10 continues with the new grid', () => {
  assert.deepEqual(baseStarts('2026-10-27'), [420, 540, 660, 780, 1020, 1140]);
});
