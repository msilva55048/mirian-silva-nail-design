import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {scheduleFor} from '../supabase/functions/_shared/whatsapp-schedule.mjs';

// Exercise the existing Deno entrypoint with fake dependencies. Network access
// is impossible: fetch and createClient are arguments to this isolated factory.
const source = readFileSync(new URL('../supabase/functions/whatsapp-reminders/index.ts', import.meta.url),'utf8')
    .replace(/^import .*?;\s*/gm, '');
const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2023}}).outputText;

function fixture({status = 'pending', enabled = false, notificationType = 'reminder_2h', now = '2026-09-10T22:30:00-03:00', appointmentDate = '2026-09-12', appointmentTime = '14:30:00'} = {}) {
    const scheduled = new Date(now);

    const appointment = {id:'appointment-test',client_id:'client-test',client_name:'Synthetic',client_phone:'55999990000',
        service_name:'Synthetic',appointment_date:appointmentDate,start_time:appointmentTime,status:'confirmed'};
    const notification = {id:1,appointment_id:appointment.id,notification_type:notificationType,
        recipient_phone:'5555999990000',template_name:notificationType === 'reminder_40h' ? 'confirmacao_agendamento_40h' : 'lembrete_agendamento_2h',template_language:'pt_BR',payload:{},
        status,attempts:status === 'pending' ? 0 : 1,provider_message_id:null,scheduled_for:scheduled.toISOString()};
    const writes = [], sends = [];
    let claims = 0, handler;
    const client = {
        from(table) {
            if (table === 'client_profiles') throw Error('No profile or opt-in queries allowed');
            let update;
            const query = {
                select(){return query;}, eq(){return query;}, neq(){return query;}, in(){return query;},
                is(){return query;}, gte(){return query;}, lte(){return query;},
                insert(data){update=data;writes.push(data);return query;},
                update(data){update=data;writes.push(data);return query;},

                then(resolve,reject) {
                    const result = update ? {error:null}
                        : {data:table === 'appointments' ? [appointment] : [notification],error:null};
                    return Promise.resolve(result).then(resolve,reject);
                },
            };
            return query;
        },
        async rpc(){claims++;return {data:[notification],error:null};},
    };
    const env = {SUPABASE_URL:'https://local.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',WHATSAPP_REMINDERS_SECRET:'synthetic',
        MIRIAN_WHATSAPP_PHONE:'5548999999999',WHATSAPP_SENDING_ENABLED:String(enabled)};
    new Function('Deno','createClient','fetch','scheduleFor','Date',compiled)(
        {env:{get:name=>env[name]},serve:callback=>{handler=callback;}},()=>client,
        async ()=>{sends.push(true);throw Error('No network permitted');},scheduleFor,class extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return Date.parse(now);} });
    return {writes,sends,get claims(){return claims;},run:()=>handler(new Request('https://local.test/',{method:'POST',headers:{'x-whatsapp-reminders-secret':'synthetic'}}))};
}
test('failed or interrupted sends are not returned to pending by reconciliation', async()=>{
    for(const status of ['failed','processing','sent']) {
        const f=fixture({status}); assert.equal((await f.run()).status,200);
        assert.ok(f.writes.every(w=>w.notification_type==='reminder_40h'));assert.equal(f.sends.length,0);
    }
});
test('queue-only never claims or sends',async()=>{
    const f=fixture();assert.equal((await f.run()).status,200);assert.equal(f.claims,0);assert.equal(f.sends.length,0);
});

const build = new Function('MIRIAN_WHATSAPP_PHONE', compiled.slice(compiled.indexOf('function brazilianDate'), compiled.indexOf('async function cancelNotification')) + ';return buildMessage;')('5548999999999');
test('exact texts, first name and encoded links',()=>{
 const a={client_name:' Ana Silva ',appointment_date:'2026-09-12',start_time:'14:30:00'};
 const short=build('reminder_2h',a);
 assert.equal(short,'Oie Ana! Tudo bem? Passando pra te lembrar que seu horário comigo é hoje, dia 12/09/2026, às 14:30. Te espero! 💅');
 const long=build('reminder_40h',a);
 assert.ok(long.startsWith('Oie Ana! Tudo bem? Passando pra lembrar do seu horário comigo amanhã, dia 12/09/2026, às 14:30. Posso confirmar sua presença? 💅'));
 const links=long.split('\n').filter(x=>x.startsWith('https://'));
 assert.equal(links.length,3);
 assert.deepEqual(links.map(x=>new URL(x).searchParams.get('text')),['Oie Mirian! Confirmo meu horário do dia 12/09/2026 às 14:30. 💅','Oie Mirian! Quero editar meu horário do dia 12/09/2026 às 14:30. Podemos ver outro horário?','Oie Mirian! Quero cancelar meu horário do dia 12/09/2026 às 14:30.']);
 assert.throws(()=>build('other',a));
});
test('backend prepares payload and never sends even with legacy flag enabled',async()=>{
 const f=fixture({enabled:true}); await f.run();
 assert.equal(f.claims,0);assert.equal(f.sends.length,0);
 assert.ok(f.writes.some(w=>w.payload?.message && w.payload.phone));
});

test('40h preparation boundary and prior-day 08:00 schedule without opt-in',async()=>{
 const early=fixture({now:'2026-09-10T22:29:59-03:00'});await early.run();
 assert.ok(!early.writes.some(w=>w.notification_type==='reminder_40h'));
 const ready=fixture();await ready.run();
 const row=ready.writes.find(w=>w.notification_type==='reminder_40h');
 assert.equal(row.scheduled_for,'2026-09-11T11:00:00.000Z');assert.equal(row.payload.version,2);
 const catchup=fixture({now:'2026-09-11T18:00:00-03:00'});await catchup.run();
 assert.ok(catchup.writes.some(w=>w.notification_type==='reminder_40h'));
 const expired=fixture({now:'2026-09-12T00:00:00-03:00'});await expired.run();
 assert.ok(!expired.writes.some(w=>w.notification_type==='reminder_40h'));
});
test('2h is procedure minus 2 hours, independent of daily 08:00',async()=>{
 const f=fixture({now:'2026-09-12T12:30:00-03:00'});await f.run();
 assert.ok(f.writes.some(w=>w.scheduled_for==='2026-09-12T15:30:00.000Z'));
});
test('frontend and active outbound code have no opt-in calls or Graph API transport',()=>{
 for(const path of ['../src/App.tsx','../supabase/functions/whatsapp-reminders/index.ts','../worker/whatsapp-web.mjs']) {
  const code=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(code,/get_my_whatsapp_opt_in|accept_whatsapp_reminders|whatsapp_opt_in|whatsapp_opt_out_at|graph\.facebook\.com|WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID|WHATSAPP_GRAPH_API_VERSION/);
 }
});
