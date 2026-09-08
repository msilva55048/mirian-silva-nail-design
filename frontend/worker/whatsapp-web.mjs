import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

import {eligibleAt} from '../supabase/functions/_shared/whatsapp-schedule.mjs';
export {eligibleAt};
const allowedTypes = new Set(['reminder_40h','reminder_2h']);
function unwrap(result) { if (result.error) throw new Error('Falha de acesso ao banco'); return result.data; }

export async function processOne(db, transport, now = () => Date.now()) {
    await transport.ready();
    const rows = unwrap(await db.rpc('claim_due_whatsapp_notifications', {p_limit:1}));
    if (!rows?.length) return false;
    if (rows.length !== 1) throw new Error('Claim retornou mais de um item; interrompido');
    const n = rows[0];
    const save = async values => {
        const updated = unwrap(await db.from('whatsapp_notifications').update({...values, updated_at:new Date().toISOString()})
            .eq('id',n.id).eq('status','processing').select('id'));
        if (updated?.length !== 1) throw new Error('Estado da notificação mudou; interrompido');
    };
    let receipt;
    try {
        if (!allowedTypes.has(n.notification_type) || n.status !== 'processing' || n.attempts !== 1 || n.provider_message_id)
            throw new Error('Notificação não elegível');
        if (n.payload?.version !== 2 || !/^55\d{10,11}$/.test(n.payload?.phone ?? '') || n.payload.phone !== n.recipient_phone || typeof n.payload.message !== 'string' || !n.payload.message.trim())
            throw new Error('Payload inválido ou antigo');
        if (!eligibleAt(n.notification_type,Date.parse(n.scheduled_for),now()))
            throw new Error('Notificação fora da janela de envio');
        receipt = await transport.send(n.payload.phone,n.payload.message);
        if (!receipt) throw new Error('Envio sem confirmação');
    } catch {
        await save({status:'failed',failed_at:new Date().toISOString(),error_message:'Falha ou envio incerto; conferir manualmente antes de qualquer nova tentativa.'});
        return true;
    }
    // A failed database write after sending must stop the process, never resend.
    await save({status:'sent',provider_message_id:receipt,sent_at:new Date().toISOString(),failed_at:null,error_message:null});
    return true;
}

export function browserTransport(page) {
    return {
        async ready() { await page.locator('#pane-side').waitFor({state:'visible',timeout:120000}); },
        async send(number,message) {
            await page.goto(`https://web.whatsapp.com/send?phone=${number}`);
            const editor = page.locator('footer [contenteditable="true"][role="textbox"]');
            await editor.waitFor({state:'visible',timeout:60000});
            // Never overwrite an existing human draft.
            if ((await editor.innerText()).trim()) throw new Error('Conversa com rascunho');
            // Only outgoing element identifiers are inspected; no incoming text.
            const outgoing = page.locator('.message-out');
            const ids = await outgoing.evaluateAll(els=>els.map(el=>el.closest('[data-id]')?.getAttribute('data-id')).filter(Boolean));
            const lines = message.split('\n');
            await editor.fill(lines[0]);
            for (const line of lines.slice(1)) {
                await editor.press('Shift+Enter');
                if (line) await editor.pressSequentially(line);
            }
            if (await editor.innerText() !== message) throw new Error('Texto diverge do payload');
            await page.locator('footer [data-icon="send"]').click({timeout:10000});
            const deadline = Date.now()+30000;
            while (Date.now()<deadline) {
                const candidates = await outgoing.evaluateAll((els,oldIds)=>els.filter(el=>!oldIds.includes(el.closest('[data-id]')?.getAttribute('data-id'))).map(el=>({id:el.closest('[data-id]')?.getAttribute('data-id'),text:el.querySelector('.selectable-text')?.innerText,ack:!!el.querySelector('[data-icon="msg-check"], [data-icon="msg-dblcheck"]')})),ids);
                const match = candidates.find(x=>x.id && !ids.includes(x.id) && x.text===message && x.ack);
                if (match) return match.id;
                await new Promise(r=>setTimeout(r,500));
            }
            throw new Error('Envio incerto');
        },
    };
}

async function main() {
    if (process.env.WHATSAPP_WEB_SENDING_ENABLED !== 'true') { console.log('Envio desabilitado. Nenhuma conexão iniciada.'); return; }
    for (const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[key]) throw new Error(`Configure ${key}`);
    const {chromium} = await import('playwright');
    const {createClient} = await import('@supabase/supabase-js');
    const db = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const context = await chromium.launchPersistentContext(resolve('worker/.session'),{headless:false});
    try {
        const page = context.pages()[0] ?? await context.newPage();
        await page.goto('https://web.whatsapp.com');
        const transport = browserTransport(page);
        do {
            const processed = await processOne(db,transport);
            if (process.argv.includes('--once')) break;
            if (!processed) await new Promise(r=>setTimeout(r,30000));
        } while (true);
    } finally { await context.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    main().catch(()=>{ console.error('Worker interrompido. Conferir fila e sessão antes de reiniciar.'); process.exitCode=1; });
