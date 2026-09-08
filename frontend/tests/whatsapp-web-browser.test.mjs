import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {browserTransport} from '../worker/whatsapp-web.mjs';

test('browser transport sends exact multiline text and only accepts a new acknowledged outgoing item',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.route('**/*',route=>route.abort());
  const html=`<div id="pane-side">Sessão fictícia</div><main id="chat"></main><footer><div role="textbox" contenteditable="true" style="min-height:30px;white-space:pre-wrap"></div><button data-icon="send">Send</button></footer><script>
   document.querySelector('button').onclick=()=>{
    const row=document.createElement('div');row.dataset.id='synthetic-outgoing';
    const bubble=document.createElement('div');bubble.className='message-out';
    const text=document.createElement('span');text.className='selectable-text';text.style.whiteSpace='pre-wrap';text.innerText=document.querySelector('[contenteditable]').innerText;
    const ack=document.createElement('span');ack.dataset.icon='msg-check';bubble.append(text,ack);row.append(bubble);document.querySelector('#chat').append(row);
   };</script>`;
  await page.setContent(html);
  const transport=browserTransport({locator:s=>page.locator(s),goto:async url=>{assert.ok(url.startsWith('https://web.whatsapp.com/send?phone=55'));await page.setContent(html);}});
  await transport.ready();
  const text='Oie Ana! 💅\n\n✅ Confirmar horário\nhttps://wa.me/5548999999999?text=Teste';
  assert.equal(await transport.send('5548999999999',text),'synthetic-outgoing');
  assert.equal(await page.locator('.message-out').count(),1);
  assert.equal(await page.locator('.selectable-text').innerText(),text);
 } finally {await browser.close();}
});
