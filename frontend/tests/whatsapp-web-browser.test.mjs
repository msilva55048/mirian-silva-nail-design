import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserTransport} from '../worker/whatsapp-web.mjs';

function pageHtml({button='legacy', oldText='', createsMessage=true}={}) {
 const buttonMarkup=button==='current' ? '<button aria-label="Enviar">Enviar</button>' : '<button data-icon="send">Enviar</button>';
 const oldMarkup=oldText ? `<div data-testid="conv-msg-old"><div data-testid="msg-container"><span aria-label="Você:"></span><span data-testid="tail-out" data-icon="tail-out"></span><span class="selectable-text">${oldText}</span></div></div>` : '';
 return `<div id="pane-side">Sessão fictícia</div><main id="chat">${oldMarkup}</main><footer><div role="textbox" contenteditable="true" style="min-height:30px;white-space:pre-wrap"></div>${buttonMarkup}</footer><script>
 document.querySelector('button').onclick=()=>{if(!${createsMessage})return;const id='synthetic-outgoing-'+Date.now();const row=document.createElement('div');row.setAttribute('data-testid','conv-msg-'+id);const bubble=document.createElement('div');bubble.setAttribute('data-testid','msg-container');const me=document.createElement('span');me.setAttribute('aria-label','Você:');const tail=document.createElement('span');tail.setAttribute('data-testid','tail-out');tail.setAttribute('data-icon','tail-out');const text=document.createElement('span');text.className='selectable-text';text.style.whiteSpace='pre-wrap';text.innerText=document.querySelector('[contenteditable]').innerText;bubble.append(me,tail,text);row.append(bubble);document.querySelector('#chat').append(row)};</script>`;
}
async function withBrowser(fn){const browser=await chromium.launch({headless:true});try{await fn(await browser.newPage())}finally{await browser.close()}}
function makeTransport(page,html,options){return browserTransport({locator:s=>page.locator(s),evaluate:(...args)=>page.evaluate(...args),goto:async url=>{assert.ok(url.startsWith('https://web.whatsapp.com/send?phone=55'));await page.setContent(html)}},options)}

test('transport atual encontra botão semântico e confirma mensagem nova',async()=>withBrowser(async page=>{
 const html=pageHtml({button:'current'});await page.setContent(html);const transport=makeTransport(page,html);await transport.ready();
 const id=await transport.send('5548999999999','Teste atual ✅');assert.match(id,/synthetic-outgoing-/);assert.equal(await page.locator('[data-testid="msg-container"]').count(),1);
}));
test('mensagem antiga com mesmo texto não é confundida com a nova',async()=>withBrowser(async page=>{
 const text='Texto repetido',html=pageHtml({button:'current',oldText:text});await page.setContent(html);const id=await makeTransport(page,html).send('5548999999999',text);
 assert.match(id,/synthetic-outgoing-/);assert.equal(await page.locator('[data-testid="msg-container"]').count(),2);
}));
test('nenhuma mensagem nova resulta em envio incerto',async()=>withBrowser(async page=>{
 const html=pageHtml({button:'current',createsMessage:false});await page.setContent(html);await assert.rejects(makeTransport(page,html,{confirmationTimeoutMs:50}).send('5548999999999','Sem confirmação'),/Envio incerto/);
}));
test('rascunho humano impede qualquer clique',async()=>withBrowser(async page=>{
 const html=pageHtml({button:'current'});await page.setContent(html);await page.locator('[contenteditable]').fill('rascunho humano');
 const transport=browserTransport({locator:s=>page.locator(s),evaluate:(...args)=>page.evaluate(...args),goto:async url=>assert.ok(url.startsWith('https://web.whatsapp.com/send?phone=55') )},{confirmationTimeoutMs:50});
 await assert.rejects(transport.send('5548999999999','Mensagem nova'),/Conversa com rascunho/);assert.equal(await page.locator('[data-testid="msg-container"]').count(),0);
}));
test('fallback legado continua enviando texto multilinha exato',async()=>withBrowser(async page=>{
 const html=pageHtml({button:'legacy'});await page.setContent(html);const text='Oie Ana! 💅\\n\\n✅ Confirmar horário\\nhttps://wa.me/5548999999999?text=Teste';
 await makeTransport(page,html).send('5548999999999',text);assert.equal(await page.locator('.selectable-text').last().innerText(),text);
}));
