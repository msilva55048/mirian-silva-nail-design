import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleFor,localInstant} from '../supabase/functions/_shared/whatsapp-schedule.mjs';

test('São Paulo: 40h preparation and prior-day 08:00 are distinct instants',()=>{
 const a={appointment_date:'2026-09-12',start_time:'14:30:00'};
 const timing=scheduleFor('reminder_40h',a);
 assert.equal(new Date(timing.prepareAt).toISOString(),'2026-09-11T01:30:00.000Z');
 assert.equal(new Date(timing.scheduledFor).toISOString(),'2026-09-11T11:00:00.000Z');
 assert.equal(new Date(timing.expiresAt).toISOString(),'2026-09-12T03:00:00.000Z');
 assert.equal(new Date(scheduleFor('reminder_2h',a).scheduledFor).toISOString(),'2026-09-12T15:30:00.000Z');
});
test('calendar subtraction crosses year and leap-month boundaries correctly',()=>{
 assert.equal(new Date(scheduleFor('reminder_40h',{appointment_date:'2027-01-01',start_time:'10:00'}).scheduledFor).toISOString(),'2026-12-31T11:00:00.000Z');
 assert.equal(new Date(scheduleFor('reminder_40h',{appointment_date:'2028-03-01',start_time:'10:00'}).scheduledFor).toISOString(),'2028-02-29T11:00:00.000Z');
 assert.equal(localInstant('2026-09-12','14:30'),Date.parse('2026-09-12T14:30:00-03:00'));
 assert.equal(scheduleFor('other',{appointment_date:'2026-09-12',start_time:'14:30'}),null);
});
