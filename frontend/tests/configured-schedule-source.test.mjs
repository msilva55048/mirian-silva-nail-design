import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getConfiguredAdminStartMinutes, getConfiguredClientStartMinutes} from '../src/shared/domain.ts';
import {getClientBookingStartContext, canServiceUseClientStart} from '../src/shared/dynamicSchedule.ts';

const date = '2026-10-20';
const override = (time, is_available = true) => ({override_date: date, start_time: time, is_available});

test('horários configurados viram fonte única no admin e na cliente', () => {
    const overrides = [override('20:00'), override('20:30')];
    const admin = getConfiguredAdminStartMinutes(date, overrides);
    const client = getConfiguredClientStartMinutes(date, overrides);
    assert.ok(admin.includes(1200));
    assert.ok(admin.includes(1230));
    assert.ok(client.includes(1200));
    assert.ok(client.includes(1230));
});

test('remoção explícita suprime horário-base e adicionado', () => {
    const overrides = [override('20:00'), override('19:30', false)];
    assert.ok(!getConfiguredAdminStartMinutes(date, overrides).includes(1170));
    assert.ok(getConfiguredAdminStartMinutes(date, overrides).includes(1200));
    assert.ok(!getConfiguredClientStartMinutes(date, overrides).includes(1170));
});

test('cliente mantém horário configurado mesmo após o limite de encaixes gerados', () => {
    const overrides = [override('20:00'), override('20:30')];
    const context = getClientBookingStartContext(date, [], overrides);
    assert.deepEqual(context.generatedStarts, []);
    assert.ok(canServiceUseClientStart(1200, 120, context));
    assert.ok(canServiceUseClientStart(1230, 30, context));
});
