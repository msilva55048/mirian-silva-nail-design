import {test} from 'node:test';
import assert from 'node:assert/strict';
import {processOne,eligibleAt} from '../worker/whatsapp-web.mjs';

function fixture({type='reminder_2h',uncertain=false,saveError=false}={}) {
 const due=new Date(type==='reminder_40h'?'2026-09-08T11:00:00Z':'2026-09-08T10:59:50Z');
 const local=new Date(due.getTime()+((type==='reminder_40h'?40:2)-3)*3600000).toISOString();
 const a={client_id:'client',client_phone:'5548999999999',status:'confirmed',appointment_date:local.slice(0,10),start_time:local.slice(11,19)};
 const n={id:1,appointment_id:'a',notification_type:type,status:'processing',attempts:1,provider_message_id:null,scheduled_for:due.toISOString(),recipient_phone:a.client_phone,payload:{version:2,phone:a.client_phone,message:'Texto exato\n💅',appointment_date:a.appointment_date,start_time:a.start_time.slice(0,5)}};
 const writes=[],sends=[];let claimed=false;
 const db={async rpc(){if(claimed)return {data:[]};claimed=true;return {data:[n]};},from(table){assert.equal(table,'whatsapp_notifications');let update;const q={select(){return q;},eq(){return q;},update(v){update=v;writes.push(v);return q;},then(resolve){resolve(saveError&&update?.status==='sent'?{error:{}}:{data:[{id:1}]});}};return q;}};
 const transport={async ready(){},async send(...args){sends.push(args);if(uncertain)throw Error();return 'outgoing-id';}};
 return {db,transport,writes,sends};
}
for(const type of ['reminder_40h','reminder_2h']) test(`${type}: exact payload sent once and receipt saved`,async()=>{
 const f=fixture({type});await processOne(f.db,f.transport,()=>Date.parse('2026-09-08T11:00:00Z'));await processOne(f.db,f.transport,()=>Date.parse('2026-09-08T11:00:00Z'));
 assert.deepEqual(f.sends,[['5548999999999','Texto exato\n💅']]);assert.equal(f.writes[0].status,'sent');assert.equal(f.writes[0].provider_message_id,'outgoing-id');
});
test('unknown type prevents send',async()=>{const f=fixture({type:'other'});await processOne(f.db,f.transport,()=>Date.parse('2026-09-08T11:00:00Z'));assert.equal(f.sends.length,0);});
test('uncertain send fails without retry',async()=>{const f=fixture({uncertain:true});await processOne(f.db,f.transport,()=>Date.parse('2026-09-08T11:00:00Z'));await processOne(f.db,f.transport,()=>Date.parse('2026-09-08T11:00:00Z'));assert.equal(f.sends.length,1);assert.equal(f.writes[0].status,'failed');});
test('database failure after send stops without reset',async()=>{const f=fixture({saveError:true});await assert.rejects(processOne(f.db,f.transport,()=>Date.parse('2026-09-08T11:00:00Z')));assert.equal(f.sends.length,1);assert.equal(f.writes.length,1);});


 test('40h catch-up remains available through prior day, not on appointment day',()=>{
  const due=Date.parse('2026-09-11T11:00:00Z');
  assert.equal(eligibleAt('reminder_40h',due,due-1),false);
  assert.equal(eligibleAt('reminder_40h',due,Date.parse('2026-09-11T22:00:00Z')),true);
  assert.equal(eligibleAt('reminder_40h',due,Date.parse('2026-09-12T03:00:00Z')),false);
 });
 test('2h runs outside 08:00 and only within tolerance',()=>{
  const due=Date.parse('2026-09-08T17:00:00Z');
  assert.equal(eligibleAt('reminder_2h',due,due-1),false);
  assert.equal(eligibleAt('reminder_2h',due,due+300000),true);
  assert.equal(eligibleAt('reminder_2h',due,due+3600000),false);
 });

// This executable check cannot connect: only the old flag is enabled.
test('legacy Edge Function flag cannot enable the local worker',async()=>{
 const {execFileSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const out=execFileSync(process.execPath,[fileURLToPath(new URL('../worker/whatsapp-web.mjs',import.meta.url))],{env:{...process.env,WHATSAPP_SENDING_ENABLED:'true',WHATSAPP_WEB_SENDING_ENABLED:'false'},encoding:'utf8'});
 assert.match(out,/Envio desabilitado/);
});
