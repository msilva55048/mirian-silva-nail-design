import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/20260913000000_waitlist_opportunity_claim.sql','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
test('claim usa RPC server-side com lock, auth e idempotência',()=>{
 assert.match(sql,/claim_waitlist_opportunity\(p_opportunity_id uuid\)/i);
 assert.match(sql,/for update/i); assert.match(sql,/auth\.uid\(\)/i);
 assert.match(sql,/pg_advisory_xact_lock/i); assert.match(sql,/status='claimed'/i);
 assert.match(sql,/status='fulfilled'/i); assert.match(sql,/claimed_appointment_id/i);
 assert.doesNotMatch(sql,/confirmation_sent_at/i);
});
test('UI oferece confirmação da oportunidade sem dados editáveis',()=>{
 assert.match(app,/Confirmar agendamento/); assert.match(app,/claim_waitlist_opportunity/);
});
