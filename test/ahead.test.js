import test from 'node:test';
import assert from 'node:assert/strict';
import { AheadEngine,addDays } from '../ahead.js';
import { createApp } from '../server.js';

test('one list combines recurring subscriptions, confirmed renewal deadlines and a three-day trial alert',()=>{
  const snapshot=new AheadEngine().snapshot();
  assert.equal(snapshot.schemaVersion,1);
  assert.equal(snapshot.items.length,3);
  const trial=snapshot.items.find(x=>x.kind==='trial');
  assert.equal(trial.chargeDate,'2026-10-03');
  assert.equal(trial.decideBy,'2026-09-30');
  assert.equal(trial.amount,15);
  assert.deepEqual(trial.evidenceIds,[15]);
  assert.equal(snapshot.alerts[0].subscriptionId,trial.id);
  const monthly=snapshot.items.find(x=>x.service==='Spotify');
  assert.equal(monthly.chargeDate,'2026-10-28');
  assert.equal(monthly.deadlineSource,'suggested_review');
  const annual=snapshot.items.find(x=>x.service==='Disney+');
  assert.equal(annual.chargeDate,'2026-11-18');
  assert.equal(annual.decideBy,'2026-11-11');
  assert.equal(annual.deadlineSource,'confirmed_notice');
  const early=new AheadEngine({today:'2026-09-29'}).snapshot();
  assert.equal(early.alerts.length,0);
});
test('verification event is deduplicated and never confirms a trial without supplied terms',()=>{
  const engine=new AheadEngine({transactions:[],terms:{'hellofresh':{trialDays:30,paidAmount:19,cadence:'monthly'}}});
  const event={id:99,account:'current',merchant:'HelloFresh',amount:-0.01,date:'2026-09-30'};
  engine.emit('transaction',event);engine.emit('transaction',event);
  assert.equal(engine.records().length,1);
  const trial=engine.records()[0];
  assert.equal(trial.status,'needs_confirmation');
  assert.equal(trial.chargeDate,'2026-10-30');
  assert.equal(engine.snapshot().alerts.length,0);
  assert.throws(()=>engine.decide(trial.id,'keep'));
  engine.decide(trial.id,'confirm_trial');
  assert.equal(engine.records()[0].confidence,'confirmed');
  assert.equal(engine.records()[0].status,'review');
  const unknown=new AheadEngine({transactions:[{...event,merchant:'Unknown service'}],terms:{}});
  assert.equal(unknown.records().length,0);
  assert.equal(addDays('2026-12-31',3),'2027-01-03');
});
test('keep exposes future recurring commitments; stop records only a cancellation request',()=>{
  const engine=new AheadEngine();
  const trial=engine.records().find(x=>x.kind==='trial');
  let result=engine.decide(trial.id,'keep');
  assert.equal(result.alerts.length,0);
  assert.deepEqual(result.recurringCommitments,[{subscriptionId:trial.id,amount:15,cadence:'monthly',from:'2026-10-03'}]);
  assert.throws(()=>engine.decide(trial.id,'request_cancellation'));
  const annual=engine.records().find(x=>x.kind==='renewal');
  result=engine.decide(annual.id,'request_cancellation');
  assert.equal(result.items.find(x=>x.id===annual.id).status,'cancellation_requested');
  assert.throws(()=>engine.decide('not-found','keep'));
});
test('Ahead API validates actions and rejects cross-origin mutation',async()=>{
  const server=createApp({apiKey:'fake-test-key'});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const snapshot=await (await fetch(base+'/api/ahead')).json();
    assert.equal(snapshot.items.length,3);
    const id=snapshot.items.find(x=>x.kind==='trial').id;
    const send=(body,origin)=>fetch(base+'/api/ahead/decision',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
    assert.equal((await send({subscriptionId:id,action:'keep'},'https://unrelated.example')).status,403);
    assert.equal((await send({subscriptionId:id,action:'execute_real_payment'})).status,400);
    const result=await send({subscriptionId:id,action:'keep'});
    assert.equal(result.status,200);
    assert.equal((await result.json()).recurringCommitments.length,1);
    const reset=await fetch(base+'/api/ahead/reset',{method:'POST'});
    const restored=await reset.json();
    assert.equal(restored.recurringCommitments.length,0);
    assert.equal(restored.alerts.length,1);
  }finally{await new Promise(r=>server.close(r));}
});
