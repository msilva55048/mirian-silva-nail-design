import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getClientBookingStartContext as context, canServiceUseClientStart as allows} from '../src/shared/dynamicSchedule.ts';

const date = '2026-10-27';
const appointment = (startTime, durationMinutes, serviceName = 'Serviço futuro') => ({
    id: startTime, date, startTime, durationMinutes, serviceName, status: 'confirmed',
});

for (const [duration, end, fits, exceeds] of [[90,510,30,90],[150,570,90,120],[180,600,60,90]]) {
    test(`anchor 07:00 permits ${duration} minutes; dynamic ending ${end} respects next anchor`, () => {
        const c = context(date, [appointment('07:00', duration)]);
        assert.equal(allows(420, duration, c), true);
        assert.ok(c.fixedStarts.includes(540));
        assert.ok(c.fixedStarts.includes(660));
        assert.ok(c.generatedStarts.includes(end));
        assert.equal(allows(end, fits, c), true);
        assert.equal(allows(end, exceeds, c), false);
    });
}

test('any service name generates endings, including a chain from dynamic starts', () => {
    for (const name of ['Normal', 'Esmaltação', 'Serviço futuro']) {
        const c = context(date, [appointment('09:00',30,name),appointment('09:30',60,name)]);
        assert.deepEqual(c.generatedStarts, [570,630]);
        assert.equal(allows(630,30,c),true);
        assert.equal(allows(630,60,c),false);
    }
});

test('invalid dynamic crossing cannot seed further endings; excluded booking cannot seed itself', () => {
    assert.deepEqual(context(date,[appointment('07:00',90),appointment('08:30',90)]).generatedStarts,[510]);
    assert.deepEqual(context(date,[appointment('07:00',90)],[],'07:00').generatedStarts,[]);
    assert.deepEqual(context(date,[{...appointment('07:00',90),status:'cancelled'}]).generatedStarts,[]);
});

test('effective overrides change classification and the next boundary', () => {
    const appointments = [appointment('07:00',90)];
    const add = {override_date:date,start_time:'08:30',is_available:true};
    assert.equal(allows(510,180,context(date,appointments,[add])),true);
    assert.equal(allows(510,30,context(date,appointments,[{...add,is_available:false}])),false);
    assert.equal(allows(510,150,context(date,appointments,[{override_date:date,start_time:'09:00',is_available:false}])),true);
});

test('repair occupation and final slot exception remain unchanged', () => {
    assert.ok(context(date,[appointment('09:00',20,'Reparo de Unha (Unitário)')]).generatedStarts.includes(570));
    assert.deepEqual(context(date,[appointment('19:00',30),appointment('19:30',30)]).generatedStarts,[1170]);
    assert.equal(allows(1170,180,context(date,[appointment('19:00',30)])),true);
});
