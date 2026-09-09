import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

import {eligibleAt} from '../supabase/functions/_shared/whatsapp-schedule.mjs';
export {eligibleAt};
export async function hasHumanDraftContent(page) {
    return page.evaluate(() => {
        const editor = document.querySelector('footer [contenteditable="true"][role="textbox"]');
        if (!editor) return false;
        const ignored = new Set(['BR','SCRIPT','STYLE']);
        const walk = node => [...node.childNodes].map(child => {
            if (child.nodeType === Node.TEXT_NODE) return child.nodeValue || '';
            if (child.nodeType !== Node.ELEMENT_NODE || ignored.has(child.nodeName)) return '';
            if (child.nodeName === 'IMG') return child.getAttribute('alt') || '';
            return walk(child);
        }).join('');
        const text = walk(editor).replace(/[\u200B\u200C\u200D\uFEFF\s]/g, '');
        const media = editor.querySelector('img[alt]:not([alt=""])') || document.querySelector('footer [data-testid*="media-preview"], footer [data-testid*="attachment"]');
        const reply = document.querySelector('footer [data-testid*="quoted"], footer [data-testid*="reply"]');
        return Boolean(text || media || reply);
    });
}
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

export function browserTransport(page, {confirmationTimeoutMs = 30000} = {}) {
    return {
        async ready() { await page.locator('#pane-side').waitFor({state:'visible',timeout:120000}); },
        async send(number,message) {
            await page.goto(`https://web.whatsapp.com/send?phone=${number}`);
            const editor = page.locator('footer [contenteditable="true"][role="textbox"]');
            await editor.waitFor({state:'visible',timeout:60000});
            // Never overwrite an existing human draft.
            if (await hasHumanDraftContent(page)) throw new Error('Conversa com rascunho');
            // Only outgoing element identifiers are inspected; no incoming text.
            const messageNodes = page.locator('[data-testid="msg-container"], .message-out');
            const before = await messageNodes.evaluateAll(els=>els.filter(el=>
                el.matches('.message-out') || el.querySelector('[data-testid="tail-out"], [data-icon="tail-out"], span[aria-label="Você:"]')
            ).map((el,index)=>({
                id: el.closest('[data-id]')?.getAttribute('data-id') || el.closest('[data-testid^="conv-msg-"]')?.getAttribute('data-testid') || null,
                index,
                text: String(el.querySelector('.selectable-text')?.innerText ?? el.innerText ?? '').replace(/\u200b/g, '').trim(),
            })));
            const beforeIds = new Set(before.map(item=>item.id).filter(Boolean));
            const observation = await page.evaluate(({message, beforeIds}) => {
                const root = document.querySelector('#main') || document.querySelector('#chat');
                if (!root) throw new Error('Painel da conversa não encontrado');
                const normalize = value => String(value ?? '').normalize('NFC').replace(/\u200b/g, '').trim();
                const extract = el => {
                    const walk = node => [...node.childNodes].map(child => child.nodeType === Node.TEXT_NODE ? child.nodeValue : child.nodeName === 'IMG' ? (child.getAttribute('alt') || '') : walk(child)).join('');
                    return normalize(walk(el.querySelector('.selectable-text') || el));
                };
                const collect = () => [...root.querySelectorAll('[data-testid="msg-container"], .message-out')].filter(el => el.matches('.message-out') || el.querySelector('[data-testid="tail-out"], [data-icon="tail-out"], span[aria-label="Você:"]')).map((el,index) => ({id: el.closest('[data-id]')?.getAttribute('data-id') || el.closest('[data-testid^="conv-msg-"]')?.getAttribute('data-testid') || null,index,text:extract(el)}));
                let resolveResult;
                const promise = new Promise(resolve => { resolveResult = resolve; });
                const observer = new MutationObserver(() => {
                    const items = collect();
                    const match = items.find(item => (item.id && !beforeIds.includes(item.id) || item.index >= beforeIds.length) && (item.text === normalize(message) || (message.endsWith('✅') && item.text === normalize(message.slice(0,-1)))));
                    if (match) { observer.disconnect(); resolveResult({match, elapsedMs: Date.now() - window.__waSendObservation.startedAt, mutations:true}); }
                });
                window.__waSendObservation = {startedAt:Date.now(), promise, observer};
                observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','data-id']});
                return {count: collect().length};
            }, {message, beforeIds:[...beforeIds]});
            console.log(`[whatsapp] saídas antes=${observation.count}; observer iniciado`);
            await editor.fill(message);
            const composerText = await page.evaluate(() => {
                const editorNode = document.querySelector('footer [contenteditable="true"][role="textbox"]');
                const walk = node => [...node.childNodes].map(child => {
                    if (child.nodeType === Node.TEXT_NODE) return child.nodeValue || '';
                    if (child.nodeName === 'BR') return '\n';
                    if (child.nodeName === 'IMG') return child.getAttribute('alt') || '';
                    const value = walk(child);
                    return ['P','DIV','LI'].includes(child.nodeName) ? `${value}\n` : value;
                }).join('');
                return String(walk(editorNode || '')).normalize('NFC').replace(/\u200b/g, '').replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
            });
            const expectedText = message.normalize('NFC').replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
            if (composerText !== expectedText) throw new Error('Texto diverge do payload');
            const sendButton = page.locator('footer button[aria-label="Enviar"]');
            if (await sendButton.count()) await sendButton.first().click({timeout:10000});
            else await page.locator('footer [data-testid="send"], footer [data-icon="wds-ic-send-filled"], footer [data-icon="send"]').first().click({timeout:10000});
            console.log('[whatsapp] clique realizado; aguardando nova saída');
            const result = await page.evaluate(timeout => Promise.race([window.__waSendObservation.promise, new Promise(resolve => setTimeout(() => resolve(null), timeout))]), confirmationTimeoutMs);
            if (result?.match) { console.log(`[whatsapp] mutação detectada; id=${result.match.id || 'sem-id'}; tempo=${result.elapsedMs}ms`); return result.match.id || `waweb-${Date.now()}-${result.match.index}`; }
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
    const profileDir = process.env.WHATSAPP_WEB_PROFILE_DIR || 'worker/.session-worker';
    const context = await chromium.launchPersistentContext(resolve(profileDir),{headless:false,channel:'chrome'});
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
