import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHandler} from './handler.mjs';
const html = readFileSync(new URL('./unavailable.html',import.meta.url),'utf8');
const req=(path='/',init={})=>new Request('https://forge.tetheredunicorn.com'+path,init);
test('outages return branded uncacheable 503 pages, including tunnel 1033/530',async()=>{
  for(const status of [500,502,503,504,520,522,524,530]){
    const r=await createHandler(html,async()=>new Response('gateway',{status}))(req());
    assert.equal(r.status,503);assert.match(await r.text(),/A brief pause/);assert.equal(r.headers.get('retry-after'),'60');assert.match(r.headers.get('cache-control'),/no-store/);
  }
});
test('offline APIs return JSON and never repeat submitted work',async()=>{
  let calls=0;
  const r=await createHandler(html,async request=>{calls++;assert.equal(await request.text(),'submitted');throw Error('offline');})(req('/api/field/chat',{method:'POST',body:'submitted'}));
  assert.equal(calls,1);assert.equal(r.status,503);assert.equal((await r.json()).ok,false);
});
test('online requests preserve cookies, auth, body, response and stream',async()=>{
  const original=new Response('stream',{headers:{'set-cookie':'session=opaque; Secure; HttpOnly'}});
  const r=await createHandler(html,async request=>{assert.equal(request.headers.get('cookie'),'session=opaque');assert.equal(request.headers.get('authorization'),'Bearer example');assert.equal(await request.text(),'original');return original;})(req('/api/field/chat',{method:'POST',headers:{cookie:'session=opaque',authorization:'Bearer example'},body:'original'}));
  assert.equal(r,original);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal(await r.text(),'stream');
});
test('auth errors and not-found responses pass through unchanged',async()=>{
  for(const status of [401,403,404,429]){const original=new Response('denied',{status});assert.equal(await createHandler(html,async()=>original)(req()),original);}
});
test('preview is independent of origin; HEAD has no body; assets get no HTML',async()=>{
  const preview=await createHandler(html,async()=>{throw Error('must not fetch');})(req('/__forge-unavailable'));assert.match(await preview.text(),/Try Forge again/);
  const head=await createHandler(html,async()=>new Response(null,{status:502}))(req('/',{method:'HEAD'}));assert.equal(await head.text(),'');
  const asset=await createHandler(html,async()=>new Response(null,{status:502}))(req('/app.js'));assert.match(asset.headers.get('content-type'),/text\/plain/);
});
test('stalled page times out; API calls receive no navigation timeout',async()=>{
  const r=await createHandler(html,async(request,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('timeout')))),5)(req());assert.equal(r.status,503);
  await createHandler(html,async(request,init)=>{assert.equal(init,undefined);return new Response('ok');})(req('/api/field/status'));
});
