import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isClientBookingDateBlocked} from '../src/features/public/bookingDateRules.ts';

for (const [date, blocked] of [
    ['2026-10-25', false],
    ['2026-10-26', false],
    ['2026-10-31', false],
    ['2026-11-01', true],
    ['2026-11-02', false],
    ['2026-11-08', true],
    ['2027-01-03', true],
    ['', false],
]) {
    test(`bloqueio de domingo: ${date || 'data vazia'}`, () => {
        assert.equal(isClientBookingDateBlocked(date), blocked);
    });
}
