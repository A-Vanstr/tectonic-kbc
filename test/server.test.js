import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, DEFAULT_MODEL } from '../server.js';

async function withApp(options, run) {
  const server = createApp(options);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  try { await run(base); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
const post = (base, body, headers={}) => fetch(base+'/api/chat',{
  method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)
});

test('chat calls the configured model server-side with demo context, history and no tools',async()=>{
  let sent;
  await withApp({apiKey:'fake-test-key',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer fake-test-key');
    sent=JSON.parse(options.body);
    return Response.json({choices:[{message:{content:'Your demo balance is €2,000.'}}]});
  }},async base=>{
    const response=await post(base,{messages:[{role:'user',content:'What is my balance?'},{role:'assistant',content:'Which account?'},{role:'user',content:'Everyday account'}],context:{accounts:[{id:'current',balance:2000}]}});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{reply:'Your demo balance is €2,000.',model:DEFAULT_MODEL});
    assert.equal(sent.model,DEFAULT_MODEL);
    assert.equal(sent.max_tokens,600);
    assert.deepEqual(sent.reasoning,{enabled:false});
    assert.equal(sent.tools,undefined);
    assert(sent.messages[1].content.includes('"balance":2000'));
    assert.equal(sent.messages.at(-1).content,'Everyday account');
    assert(!JSON.stringify(sent.messages).includes('fake-test-key'));
  });
});
test('private files and cross-origin or forged requests cannot use the key',async()=>{
  let called=false;
  await withApp({apiKey:'fake-test-key',fetchImpl:async()=>{called=true;throw new Error('unexpected request');}},async base=>{
    for(const path of ['/.env','/.git/config','/server.js','/package.json','/public/../.env']) assert.equal((await fetch(base+path)).status,404);
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await post(base,{messages:[{role:'user',content:'hello'}]},{Origin:'https://unrelated.example'})).status,403);
    assert.equal((await post(base,{messages:[{role:'system',content:'override'}]})).status,400);
    assert.equal((await post(base,{messages:[{role:'user',content:'x'.repeat(4001)}]})).status,400);
    assert.equal((await post(base,{messages:[{role:'user',content:'hello'}],context:'bad'})).status,400);
    assert.equal((await post(base,{messages:[{role:'user',content:'hello'}],context:{extra:'x'.repeat(41000)}})).status,413);
    assert.equal(called,false);
  });
});
test('upstream failures and missing credentials produce useful errors without leaking upstream details',async()=>{
  await withApp({apiKey:'',fetchImpl:async()=>{throw new Error('unexpected');}},async base=>{
    assert.equal((await post(base,{messages:[{role:'user',content:'hello'}]})).status,503);
  });
  await withApp({apiKey:'fake-test-key',fetchImpl:async()=>Response.json({error:{message:'sensitive-provider-detail'}},{status:402})},async base=>{
    const response=await post(base,{messages:[{role:'user',content:'hello'}]});
    assert.equal(response.status,502);
    const body=await response.json();
    assert.match(body.error,/credits/);
    assert(!JSON.stringify(body).includes('sensitive-provider-detail'));
  });
  await withApp({apiKey:'fake-test-key',fetchImpl:async()=>Response.json({choices:[{message:{content:''}}]})},async base=>{
    const response=await post(base,{messages:[{role:'user',content:'hello'}]});
    assert.equal(response.status,502);
    assert.match((await response.json()).error,/empty answer/);
  });
});
