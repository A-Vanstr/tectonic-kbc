import { EventEmitter } from 'node:events';
import { transactions as fixtures, subscriptionTerms } from './public/data.js';

export const DEMO_DATE = '2026-09-30';
const day = 86_400_000;
const stamp = d=>Date.parse(d+'T00:00:00Z');
const iso = t=>new Date(t).toISOString().slice(0,10);
export const addDays = (d,n)=>iso(stamp(d)+n*day);
const normalize = s=>s.trim().toLowerCase().replace(/disney\s+plus/g,'disney+');
const title = s=>({'spotify':'Spotify','disney+':'Disney+','amazon prime':'Amazon Prime'}[s]||s);
function advance(d,cadence){
  const current = new Date(stamp(d));
  const month = current.getUTCMonth()+(cadence==='annual'?12:1);
  const end = new Date(Date.UTC(current.getUTCFullYear(),month+1,0)).getUTCDate();
  return iso(Date.UTC(current.getUTCFullYear(),month,Math.min(current.getUTCDate(),end)));
}
function expectedDate(last,cadence,today){
  let next=advance(last,cadence);
  while(next<today) next=advance(next,cadence);
  return next;
}
const action = (id,label)=>({id,label});

export class AheadEngine extends EventEmitter {
  constructor({transactions=fixtures,terms=subscriptionTerms,today=DEMO_DATE}={}){
    super();this.today=today;this.terms=terms;this.transactions=[];this.decisions=new Map();
    this.on('transaction',transaction=>{
      if(!this.transactions.some(t=>t.id===transaction.id))this.transactions.push(transaction);
    });
    for(const t of transactions)this.emit('transaction',t);
  }
  records(){
    const grouped=new Map();
    for(const t of this.transactions){
      if(t.date>this.today)continue;
      const key=normalize(t.merchant);
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(t);
    }
    const records=[];
    for(const [key,history] of grouped){
      const paid=history.filter(t=>t.amount<-1).sort((a,b)=>a.date.localeCompare(b.date));
      const terms=this.terms[key];
      if(paid.length>=2){
        const gaps=paid.slice(1).map((t,i)=>(stamp(t.date)-stamp(paid[i].date))/day).sort((a,b)=>a-b);
        const gap=gaps[Math.floor(gaps.length/2)];
        const cadence=gap>=26&&gap<=35?'monthly':gap>=350&&gap<=380?'annual':null;
        const consistent=gaps.every(n=>Math.abs(n-gap)<=7);
        if(cadence&&consistent){
          const last=paid.at(-1),chargeDate=expectedDate(last.date,cadence,this.today);
          const confirmed=terms?.confirmed===true&&Number.isInteger(terms.noticeDays);
          const decideBy=addDays(chargeDate,-(confirmed?terms.noticeDays:3));
          records.push({id:'recurring-'+key.replace(/\W/g,'-'),service:title(key),kind:cadence==='annual'?'renewal':'subscription',amount:Math.abs(last.amount),currency:'EUR',cadence,chargeDate,decideBy,deadlineSource:confirmed?'confirmed_notice':'suggested_review',status:'review',confidence:'likely',evidenceIds:paid.map(t=>t.id),explanation:confirmed?terms.source:`${paid.length} similar payments suggest a ${cadence} subscription. Review date is a reminder, not a verified cancellation deadline.`});
        }
      }
      const checks=history.filter(t=>t.amount<=0&&Math.abs(t.amount)<=0.01).sort((a,b)=>b.date.localeCompare(a.date));
      const check=checks[0];
      // A signal only: never invent trial length or price from a verification payment.
      if(check&&terms?.trialDays&&!paid.some(t=>t.date>=check.date)){
        const chargeDate=addDays(check.date,terms.trialDays);
        const confirmed=terms.confirmed===true&&terms.transactionId===check.id;
        if(chargeDate>=this.today)records.push({id:'trial-'+check.id,service:title(key),kind:'trial',amount:terms.paidAmount,currency:'EUR',cadence:terms.cadence,chargeDate,decideBy:addDays(chargeDate,-3),deadlineSource:confirmed?'confirmed_trial':'unconfirmed_trial',status:confirmed?'review':'needs_confirmation',confidence:confirmed?'confirmed':'possible',evidenceIds:[check.id],explanation:confirmed?`${terms.source}. ${terms.trialDays}-day trial after a ${Math.abs(check.amount).toFixed(2)} EUR verification on ${check.date}.`:'A small verification payment may indicate a trial. Confirm the demo terms before relying on its dates or price.'});
      }
    }
    return records.map(record=>{
      const decision=this.decisions.get(record.id);
      if(decision)record.status=decision;
      record.actions=record.status==='needs_confirmation'?[action('confirm_trial','Confirm trial terms'),action('dismiss','Not a trial')]:record.status==='review'?[action('request_cancellation','Stop subscription for me'),action('keep','Keep subscription')]:[];
      return record;
    }).sort((a,b)=>a.decideBy.localeCompare(b.decideBy)||a.id.localeCompare(b.id));
  }
  snapshot(){
    const items=this.records();
    const alerts=items.filter(r=>r.kind==='trial'&&r.status==='review'&&r.confidence==='confirmed'&&r.decideBy<=this.today).map(r=>({
      type:'trial_ending',subscriptionId:r.id,message:`Your free trial with ${r.service} ends on ${new Date(stamp(r.chargeDate)).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})}. After that, the demo plan costs €${r.amount.toFixed(2)} per ${r.cadence==='monthly'?'month':'year'}. Would you like to keep it?`,actions:r.actions
    }));
    return {schemaVersion:1,demoDate:this.today,items,alerts,recurringCommitments:items.filter(r=>r.status==='kept').map(r=>({subscriptionId:r.id,amount:r.amount,cadence:r.cadence,from:r.chargeDate}))};
  }
  decide(id,decision){
    const record=this.records().find(r=>r.id===id);
    if(!record)throw new Error('Subscription not found.');
    if(!record.actions.some(a=>a.id===decision))throw new Error('This decision is not available for this subscription.');
    const statuses={keep:'kept',request_cancellation:'cancellation_requested',confirm_trial:'review',dismiss:'dismissed'};
    this.decisions.set(id,statuses[decision]);
    if(decision==='confirm_trial'){
      const t=this.transactions.find(t=>t.id===record.evidenceIds[0]);
      const key=normalize(t.merchant);
      // Copy rather than change the shared fixtures.
      this.terms={...this.terms,[key]:{...this.terms[key],confirmed:true,transactionId:t.id}};
    }
    return this.snapshot();
  }
}
