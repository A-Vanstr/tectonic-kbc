import {customer,accounts,transactions,scheduled,cards} from './data.js';
const paths={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',wallet:'M3 6h16v14H3z M3 6V4h14v2 M15 11h6v5h-6z',savings:'M4 11a7 7 0 0 1 13-4l3 1v7l-3 1-1 4h-3v-3H8l-1 3H4l-1-5H1v-4h3 M10 5V2h4 M16 10h.01',home:'M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',transfer:'M3 7h17l-4-4 M21 17H4l4 4',card:'M3 5h18v14H3z M3 10h18 M6 15h4',shield:'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6',chart:'M3 3v18h18 M7 16l4-6 4 3 5-7',file:'M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6',help:'M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3 M12 18h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',bell:'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5z M10 21h4',plus:'M12 5v14 M5 12h14',search:'M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14 M15 15l6 6',basket:'M3 9h18l-2 11H5z M7 9l3-6 M17 9l-3-6 M9 13v4 M15 13v4',train:'M6 3h12v14H6z M6 9h12 M9 13h.01 M15 13h.01 M8 17l-3 4 M16 17l3 4',work:'M3 7h18v13H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',coffee:'M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M17 9h2a3 3 0 0 1 0 6h-2 M8 2v3 M13 2v3',music:'M9 18V5l11-2v13 M9 15c-6-2-8 6-2 6 2 0 2-2 2-3 M20 13c-6-2-8 6-2 6 2 0 2-2 2-3',bolt:'M13 2L4 14h7l-1 8 10-13h-7z',wifi:'M3 7a15 15 0 0 1 18 0 M6 11a10 10 0 0 1 12 0 M9 15a5 5 0 0 1 6 0 M12 19h.01',calendar:'M4 5h16v16H4z M4 10h16 M8 2v5 M16 2v5',download:'M12 3v12 M7 10l5 5 5-5 M3 16v5h18v-5',lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',users:'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3 M16 4a4 4 0 0 1 0 8 M18 14a5 5 0 0 1 4 5v2'};
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.wallet}"/></svg>`;
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat('en-BE',{style:'currency',currency:'EUR'}).format(n);
const signed=n=>n===0?money(0):(n>0?'+ ':'− ')+money(Math.abs(n));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=d=>new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const nav=[['overview','Overview','overview'],['accounts','Accounts','wallet'],['payments','Payments','transfer'],['kate-ahead','Kate Ahead','calendar'],['cards','Cards','card'],['insurance','Insurance','shield'],['investments','Investments','chart'],['documents','Documents','file']];
let view='overview',filterAccount='all',search='',paymentTab='upcoming',hidden=false;
$('#navigation').innerHTML=nav.map(([id,label,i])=>`<a href="#${id}" data-view="${id}" aria-label="${label}">${icon(i)}<span>${label}</span></a>`).join('');
$('#privacy').innerHTML=icon('eye');$('#notifications').innerHTML=icon('bell');$('#help-button').innerHTML=icon('help')+'Help & contact';
const button=(label,action,i='')=>`<button class="button" data-action="${action}">${i?icon(i):''}${label}</button>`;
function heading(title,sub,action='transfer'){return `<div class="page-heading"><div><div class="eyebrow">Your personal banking</div><h1>${title}</h1><p>${sub}</p></div>${action?`<div class="heading-actions"><button class="button primary" data-action="${action}">${icon('plus')} New transfer</button></div>`:''}</div>`;}
function accountTiles(){return `<div class="accounts-grid">${accounts.map(a=>`<button class="account-card ${a.color}" data-account="${a.id}"><div class="account-top"><span class="icon-tile ${a.color}">${icon(a.icon)}</span><span class="account-type">${a.type}</span></div><h3>${a.name}</h3><span class="account-number">${a.number}</span><div class="account-balance money">${money(a.balance)}</div><span class="account-caption">Available balance</span></button>`).join('')}</div>`;}
function txList(limit=100){const filtered=transactions.filter(t=>(filterAccount==='all'||t.account===filterAccount)&&`${t.merchant} ${t.category} ${t.reference}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,limit);let previous='';return filtered.length?filtered.map(t=>{const divider=previous===t.date?'':`<div class="transaction-date">${t.date==='2026-09-30'?'Today · 30 September':t.date==='2026-09-29'?'Yesterday · 29 September':date(t.date)}</div>`;previous=t.date;return divider+`<button class="transaction" data-tx="${t.id}"><span class="icon-tile ${t.color}">${icon(t.icon)}</span><span class="transaction-info"><strong>${escape(t.merchant)}</strong><small>${escape(t.category)} · ${accounts.find(a=>a.id===t.account).name}</small></span><span class="amount money ${t.amount>0?'positive':''}">${signed(t.amount)}</span></button>`;}).join(''):'<div class="empty">No transactions match your search.</div>';}
function transactionPanel(all=false){return `<section class="panel"><div class="panel-header"><h2>${all?'Transactions':'Recent transactions'}</h2>${all?button('Export CSV','export','download'):'<button class="text-button" data-action="transactions">View all</button>'}</div><div class="filterbar"><div class="search-wrap">${icon('search')}<input id="transaction-search" type="search" placeholder="Search transactions" aria-label="Search transactions" value="${escape(search)}"></div><select id="account-filter" aria-label="Filter account"><option value="all">All accounts</option>${accounts.map(a=>`<option value="${a.id}" ${filterAccount===a.id?'selected':''}>${a.name}</option>`).join('')}</select></div><div id="transaction-list">${txList(all?100:5)}</div>${all?'':'<div class="panel-footer"><button class="text-button" data-action="transactions">See all transactions</button></div>'}</section>`;}
function upcoming(){return scheduled.map((s,i)=>`<button class="transaction" data-schedule="${i}"><span class="icon-tile">${icon(s.icon)}</span><span class="transaction-info"><strong>${s.name}</strong><small>${date(s.date)} · ${s.method}</small></span><span class="amount money">− ${money(s.amount)}</span></button>`).join('');}
function cardVisual(c){return `<div class="bank-card ${c.id==='credit'?'credit':''}"><div class="card-top"><strong>KBC</strong><span>${c.id==='debit'?'Debit':'Credit'}</span></div><div class="chip" aria-hidden="true"></div><div class="card-number">${c.number}</div><div class="card-bottom"><span>${c.holder}</span><span>${c.expiry}</span></div></div>`;}
function overview(){return heading(`Hello, ${customer.firstName}`,'Good to see you. Here’s your banking at a glance.')+aheadHero()+`<div class="section-title"><h2>Your accounts</h2><span class="page-heading" style="margin:0"><span class="date-badge">${icon('calendar')} Wednesday, 30 September 2026</span></span></div>`+accountTiles()+`<div class="quick-actions"><button class="quick-action" data-action="transfer">${icon('transfer')}Make a transfer</button><button class="quick-action" data-action="payments">${icon('calendar')}Upcoming payments</button><button class="quick-action" data-action="documents">${icon('file')}Account statements</button></div><div class="dashboard-grid">${transactionPanel()}<div class="right-column"><section class="panel"><div class="panel-header"><h2>Coming up</h2><button class="text-button" data-action="payments">View all</button></div>${scheduled.slice(0,2).map((s,i)=>`<div class="upcoming-row"><span class="icon-tile">${icon(s.icon)}</span><span class="transaction-info"><strong>${s.name}</strong><small>${date(s.date)}</small></span><span class="amount money">− ${money(s.amount)}</span></div>`).join('')}</section><section class="panel"><div class="panel-header"><h2>Your debit card</h2><button class="text-button" data-action="cards">Manage</button></div>${cardVisual(cards[0])}<div class="card-status"><span>${cards[0].frozen?'Temporarily frozen':'Ready to use'}</span><span>Everyday account</span></div></section><div class="kate-preview"><span class="kate-symbol">✦</span><h3>A little help from Kate</h3><p>Ask a question about your accounts, upcoming payments or everyday banking.</p><button class="text-button" data-action="kate">Start a conversation</button></div></div></div>`;}
function accountsPage(){return heading('Your accounts','A clear view of your everyday money and savings.')+accountTiles()+`<div style="margin-top:28px">${transactionPanel(true)}</div>`;}
function paymentsPage(){return heading('Payments','Your transfers and scheduled payments, in one place.')+`<div class="tabs"><button data-tab="upcoming" class="${paymentTab==='upcoming'?'active':''}">Upcoming payments</button><button data-tab="history" class="${paymentTab==='history'?'active':''}">Transfer history</button></div>`+(paymentTab==='upcoming'?`<section class="panel"><div class="panel-header"><h2>Scheduled payments</h2><span class="muted" style="font-size:13px">Next 7 days</span></div>${upcoming()}<div class="panel-footer muted" style="font-size:12px">Payments are shown for demonstration purposes.</div></section>`:transactionPanel(true));}
function cardsPage(){return heading('Your cards','Manage your cards and check your spending limits.',null)+`<div class="view-grid cards-page">${cards.map(c=>`<section class="panel product-card"><div class="section-title"><h2>${c.name}</h2><span class="account-type">${c.frozen?'Frozen':'Active'}</span></div>${cardVisual(c)}<div class="detail-line"><span>Linked account</span><strong>Everyday account</strong></div><div class="detail-line"><span>Monthly spending</span><strong class="money">${money(c.spent)} / ${money(c.limit)}</strong></div><div class="limit-track"><span style="width:${c.spent/c.limit*100}%"></span></div><button class="button" data-freeze="${c.id}">${icon('lock')}${c.frozen?'Unfreeze card':'Freeze card'}</button></section>`).join('')}</div>`;}
function insurancePage(){return heading('Your insurance','Your cover, policy details and documents.',null)+`<div class="view-grid">${[{name:'Your home',icon:'home',product:'KBC Home Insurance',detail:'Fictional home · Antwerp',premium:24.80,number:'DEMO-HOME-2048'},{name:'You & your family',icon:'users',product:'KBC Family Insurance',detail:'Personal liability cover',premium:7.65,number:'DEMO-FAMILY-1062'}].map(p=>`<section class="panel product-card"><span class="icon-tile">${icon(p.icon)}</span><h3>${p.name}</h3><p>${p.product}</p><div class="detail-line"><span>Policy</span><strong>${p.number}</strong></div><div class="detail-line"><span>Monthly premium</span><strong class="money">${money(p.premium)}</strong></div><div class="detail-line"><span>Cover</span><strong>${p.detail}</strong></div><button class="button" data-policy="${p.number}">View policy</button></section>`).join('')}</div>`;}
function investmentsPage(){return heading('Your investments','Keep an eye on your investment portfolio.',null)+`<section class="panel product-card"><div class="section-title"><h2>KBC Investment Plan</h2><span class="account-type">Demo portfolio</span></div><div class="account-balance money">${money(6842.15)}</div><span class="positive" style="font-size:13px">+ ${money(342.15)} since January</span><svg class="investment-plot" viewBox="0 0 800 120" preserveAspectRatio="none" role="img" aria-label="Fictional portfolio value rises from January to September"><path d="M0 102L45 96 90 102 130 82 170 91 210 65 250 71 300 48 350 60 390 40 430 47 470 34 520 43 570 21 610 34 660 17 710 24 760 9 800 14"/></svg><div class="detail-line"><span>Monthly contribution</span><strong class="money">${money(150)}</strong></div><div class="detail-line"><span>Next contribution</span><strong>5 October 2026</strong></div><div class="detail-line"><span>Investment profile</span><strong>Balanced · fictional</strong></div><p style="font-size:12px">Illustrative values only. This demo does not represent a real product’s performance.</p></section>`;}
function documentsPage(){return heading('Your documents','Statements and policy documents, ready when you need them.',null)+`<section class="panel">${[{title:'Account statement · September 2026',detail:'Everyday account · Demo statement',id:'statement'},{title:'Home insurance policy',detail:'DEMO-HOME-2048 · Demo policy',id:'home'},{title:'Family insurance policy',detail:'DEMO-FAMILY-1062 · Demo policy',id:'family'}].map(d=>`<div class="document-row"><span class="icon-tile">${icon('file')}</span><div class="transaction-info"><strong>${d.title}</strong><small>${d.detail}</small></div><button class="button" data-document="${d.id}">${icon('download')}Download</button></div>`).join('')}</section>`;}
let aheadState=null,aheadError='',aheadLoading=false;
async function loadAhead(){
  aheadLoading=true;aheadError='';
  try{const response=await fetch('/api/ahead');const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load subscriptions.');aheadState=result;}
  catch(error){aheadError=error.message;}
  finally{aheadLoading=false;if(view==='kate-ahead')render();}
}
const subscriptionStatus={review:'To review',kept:'Keeping',cancellation_requested:'Stop requested · demo',needs_confirmation:'Confirm trial',dismissed:'Not a trial'};
function subscriptionActions(item){return item.actions.map(a=>`<button class="button ${a.id==='keep'?'primary':''}" data-subscription-action="${escape(a.id)}" data-subscription-id="${escape(item.id)}">${escape(a.label)}</button>`).join('');}
function aheadPage(){
  if(!aheadState&&!aheadError&&!aheadLoading)loadAhead();
  let body;
  if(aheadError)body=`<div class="panel product-card"><p role="alert">${escape(aheadError)}</p><button class="button" id="reload-ahead">Try again</button></div>`;
  else if(!aheadState)body='<div class="panel product-card" role="status">Finding your subscriptions…</div>';
  else body=`${aheadState.alerts.map(alert=>{const item=aheadState.items.find(x=>x.id===alert.subscriptionId);return `<section class="ahead-alert"><span class="kate-symbol">✦</span><div><span class="eyebrow">A decision for today</span><h2>Your ${escape(item.service)} trial is ending</h2><p>${escape(alert.message)}</p><button class="text-button" data-subscription-details="${escape(item.id)}">Review trial</button></div><span class="ahead-alert-date">Decide by<strong>${date(item.decideBy)}</strong></span></section>`;}).join('')}<section class="panel ahead-list"><div class="panel-header"><h2>Subscriptions & renewals</h2><span class="muted">${aheadState.items.length} services</span></div>${aheadState.items.length?aheadState.items.map(item=>`<article class="subscription-row" data-subscription="${escape(item.id)}"><span class="icon-tile ${item.kind==='trial'?'orange':item.kind==='renewal'?'purple':'green'}">${icon(item.kind==='trial'?'card':item.kind==='renewal'?'calendar':'music')}</span><div class="subscription-main"><div class="subscription-title"><h3>${escape(item.service)}</h3><span class="subscription-tag">${item.kind==='trial'?'Free trial':item.kind==='renewal'?'Annual renewal':'Subscription'}</span></div><p><span class="money">${money(item.amount)}</span> / ${item.cadence==='monthly'?'month':'year'} · ${item.kind==='trial'?'First payment':'Next payment'} ${date(item.chargeDate)}</p><span class="deadline-source">${item.deadlineSource==='confirmed_trial'?'Demo trial terms confirmed':item.deadlineSource==='confirmed_notice'?'Demo notice period confirmed':'Suggested review date · check provider terms'}</span><button class="text-button evidence-button" data-subscription-details="${escape(item.id)}">Why Kate flagged this</button></div><div class="subscription-decision"><span class="decide-label">Decide by</span><strong>${date(item.decideBy)}</strong><span class="decision-status ${item.status==='review'&&item.decideBy<=aheadState.demoDate?'due':''}">${escape(subscriptionStatus[item.status])}</span></div><div class="subscription-actions">${subscriptionActions(item)}</div></article>`).join(''):'<p class="empty">No subscriptions detected yet.</p>'}</section><p class="ahead-footnote">Dates and prices are fictional. Suggested review dates are reminders; only confirmed terms establish a notice period. Stopping a debit does not cancel a merchant contract.</p>`;
  return heading('Kate Ahead','Kate looks 90 days ahead, so you see the bump before you hit it.',null)+`<div class="ahead-toolbar"><span>${icon('calendar')} Looking ahead from 30 September 2026</span><span class="account-type">Demo data</span></div>`+forecastSection()+`<h2 class="ahead-subtitle">Subscriptions & renewals</h2>`+body+forecastDetails();
}
function subscriptionDetails(id){
  const item=aheadState.items.find(x=>x.id===id);if(!item)return;
  const evidence=item.evidenceIds.map(id=>transactions.find(t=>t.id===id)).filter(Boolean);
  modal(item.service,`<p>${escape(item.explanation)}</p><div class="detail-line"><span>First / next payment</span><strong>${date(item.chargeDate)}</strong></div><div class="detail-line"><span>Decide by</span><strong>${date(item.decideBy)}</strong></div><div class="detail-line"><span>Plan cost</span><strong class="money">${money(item.amount)} / ${item.cadence==='monthly'?'month':'year'}</strong></div><h3 style="margin-top:23px">Payment evidence</h3>${evidence.map(t=>`<div class="detail-line"><span>${date(t.date)} · ${escape(t.merchant)}</span><strong class="money">${money(Math.abs(t.amount))}</strong></div>`).join('')}<p class="form-note">${item.deadlineSource==='suggested_review'?'A payment pattern suggests a subscription. Check cancellation terms with the service.':'Trial duration, price and notice terms are supplied demo facts.'}</p><div class="subscription-actions in-modal">${subscriptionActions(item)}</div>`);
}
async function saveSubscriptionDecision(id,action){
  const buttons=document.querySelectorAll('[data-subscription-action],#confirm-subscription-action');buttons.forEach(b=>b.disabled=true);
  try{const response=await fetch('/api/ahead/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscriptionId:id,action})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save this decision.');aheadState=result;if($('#modal').open)$('#modal').close();render();loadForecast();toast(action==='keep'?'Keeping this service. Added to demo recurring commitments.':action==='request_cancellation'?'Demo stop request recorded. No real subscription was cancelled.':action==='dismiss'?'Marked as not a trial.':'Trial terms confirmed.');}
  catch(error){toast(error.message);buttons.forEach(b=>b.disabled=false);}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='reload-ahead'){aheadError='';loadAhead();render();}
  if(b.dataset.subscriptionDetails)subscriptionDetails(b.dataset.subscriptionDetails);
  if(b.dataset.subscriptionAction){
    const id=b.dataset.subscriptionId,action=b.dataset.subscriptionAction,item=aheadState.items.find(x=>x.id===id);
    if(action==='request_cancellation'||action==='confirm_trial'){
      if($('#modal').open)$('#modal').close();
      modal(action==='request_cancellation'?'Review stop request':'Confirm demo trial terms',`<p>${action==='request_cancellation'?`Record a demo cancellation request for ${escape(item.service)}?`:`Confirm the fictional ${escape(item.service)} trial ends on ${date(item.chargeDate)} and then costs ${money(item.amount)} per ${item.cadence==='monthly'?'month':'year'}?`}</p><p class="form-note">${action==='request_cancellation'?'This prototype records a request only. It does not contact the merchant, block a direct debit or cancel a real contract.':'A verification payment alone does not establish a trial. These terms are supplied solely for the demo.'}</p><button class="button primary full" id="confirm-subscription-action">${action==='request_cancellation'?'Confirm demo stop request':'Confirm terms'}</button>`);
      $('#confirm-subscription-action').onclick=()=>saveSubscriptionDecision(id,action);
    }else saveSubscriptionDecision(id,action);
  }
});
// ---- Kate Ahead: 90-day forecast ----
let fc=null,fcError='';
const weatherIcon={sunny:'☀️',cloudy:'⛅',storm:'⛈️'};
const weatherText={sunny:'Comfortable',cloudy:'Tight',storm:'Likely short'};
const shortDate=d=>new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
async function loadForecast(){
  try{const r=await fetch('/api/forecast');const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not load the forecast.');fc=j;fcError='';}
  catch(e){fcError=e.message;}
  updateAheadPill();if(view==='kate-ahead'||view==='overview')render();
}
function riskHeadline(f){
  if(!f.risk)return {icon:'☀️',title:'The next 90 days look comfortable',text:`Your balance stays above your ${money(f.buffer)} comfort buffer.`};
  const r=f.risk,range=r.from===r.to?shortDate(r.from):`${shortDate(r.from)}–${shortDate(r.to)}`;
  return {icon:r.severity==='shortfall'?'⛈️':'⛅',title:`${range} looks tight`,text:`Your balance is likely to drop to about ${money(r.lowestExpected)} on ${shortDate(r.lowestDate)}${r.lowestLow<0?`, and could go below zero (${money(r.lowestLow)}) in a bad case`:''}. Kate spotted it ${Math.round((Date.parse(r.from)-Date.parse(f.today))/864e5)} days early.`};
}
function updateAheadPill(){
  const pill=$('#ahead-pill');if(!pill)return;
  if(!fc){pill.innerHTML='<span class="kate-symbol">✦</span> Kate Ahead';return;}
  const h=riskHeadline(fc);
  pill.innerHTML=`<span class="kate-symbol">✦</span><span class="pill-label">Kate Ahead</span><span class="pill-status">${h.icon} ${escape(fc.risk?shortDate(fc.risk.from)+' looks tight':'All clear')}</span>`;
  pill.classList.toggle('warn',!!fc.risk);
}
const euroShort=v=>(v<0?'−':'')+'€'+(Math.abs(v)>=1000?(Math.abs(v)/1000).toFixed(Math.abs(v)%1000?1:0)+'k':Math.round(Math.abs(v)));
function forecastChart(f){
  const W=900,H=300,pad={l:52,r:18,t:34,b:40};
  const pts=[{date:f.today,expected:f.startBalance},...f.days];
  const exp=pts.map(p=>p.expected);
  const step=Math.max(...exp)-Math.min(0,...exp)>2500?1000:500;
  const yMin=Math.min(0,Math.floor(Math.min(...exp)/step)*step),yMax=Math.ceil(Math.max(...exp)*1.08/step)*step;
  const x=i=>pad.l+(W-pad.l-pad.r)*i/(pts.length-1),y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-yMin)/(yMax-yMin));
  const line=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.expected).toFixed(1)}`).join('');
  const area=`${line}L${x(pts.length-1).toFixed(1)} ${y(yMin)}L${x(0)} ${y(yMin)}Z`;
  const ticks=[];for(let v=yMin;v<=yMax;v+=step)ticks.push(v);
  const grid=ticks.map(v=>`<line class="fc-grid" x1="${pad.l}" x2="${W-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="fc-axis" x="${pad.l-10}" y="${y(v)+4}" text-anchor="end">${euroShort(v)}</text>`).join('');
  const zone=`<rect class="fc-zone" x="${pad.l}" y="${y(f.buffer)}" width="${W-pad.l-pad.r}" height="${y(yMin)-y(f.buffer)}"/><line class="fc-buffer" x1="${pad.l}" x2="${W-pad.r}" y1="${y(f.buffer)}" y2="${y(f.buffer)}"/><text class="fc-zone-label" x="${pad.l+8}" y="${y(f.buffer)+14}">Your ${euroShort(f.buffer)} buffer</text>`;
  const months=pts.map((p,i)=>i&&p.date.endsWith('-01')?`<line class="fc-grid month" x1="${x(i)}" x2="${x(i)}" y1="${pad.t}" y2="${H-pad.b}"/><text class="fc-axis month" x="${x(i)+6}" y="${H-pad.b+18}">${new Date(p.date+'T12:00:00').toLocaleDateString('en-GB',{month:'long'})}</text>`:'').join('');
  // Red where the line dips below the buffer.
  let danger='';for(let i=1;i<pts.length;i++)if(pts[i].expected<f.buffer||pts[i-1].expected<f.buffer&&pts[i].expected<pts[i-1].expected)danger+=`<line class="fc-line danger" x1="${x(i-1)}" y1="${y(pts[i-1].expected)}" x2="${x(i)}" y2="${y(pts[i].expected)}"/>`;
  const idx=d=>pts.findIndex(p=>p.date===d);
  const paydays=f.events.filter(e=>e.kind==='income').map(e=>{const i=idx(e.date);return i<0?'':`<g class="fc-pay"><circle cx="${x(i)}" cy="${y(pts[i].expected)}" r="5"/><text x="${x(i)}" y="${y(pts[i].expected)-12}" text-anchor="middle">Payday</text></g>`;}).join('');
  const transfer=f.events.filter(e=>e.kind==='transfer').map(e=>{const i=idx(e.date);return i<0?'':`<g class="fc-transfer"><circle cx="${x(i)}" cy="${y(pts[i].expected)}" r="5"/><text x="${x(i)}" y="${y(pts[i].expected)-12}" text-anchor="middle">+${euroShort(e.amount)} savings</text></g>`;}).join('');
  let low='';
  const target=f.risk?pts[idx(f.risk.lowestDate)]:pts.slice(1).reduce((a,b)=>b.expected<a.expected?b:a);
  if(target){const i=idx(target.date),lx=x(i),ly=y(target.expected),label=`${shortDate(target.date)}: ≈ ${money(Math.max(0,target.expected)).replace(/\.\d\d$/,'')} left`,w=label.length*6.6+20,bx=Math.min(Math.max(lx-w/2,pad.l),W-pad.r-w),by=ly>H/2?ly-40:Math.min(ly+14,H-pad.b-30);
    low=`<g class="fc-callout ${f.risk?'warn':''}"><circle cx="${lx}" cy="${ly}" r="6"/><rect x="${bx}" y="${by}" width="${w}" height="24" rx="12"/><text x="${bx+w/2}" y="${by+16}" text-anchor="middle">${escape(label)}</text></g>`;}
  const today=`<g class="fc-today"><circle cx="${x(0)}" cy="${y(f.startBalance)}" r="5"/><text x="${x(0)+10}" y="${y(f.startBalance)-10}">Today ${euroShort(f.startBalance)}</text></g>`;
  return `<div class="fc-wrap" data-fc-chart><svg class="fc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Expected balance of your current account for the next 90 days"><defs><linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#007ab8" stop-opacity=".22"/><stop offset="1" stop-color="#007ab8" stop-opacity=".02"/></linearGradient></defs>${grid}${zone}${months}<path class="fc-area" d="${area}"/><path class="fc-line" d="${line}"/>${danger}${paydays}${transfer}${today}${low}<line class="fc-hover-line" x1="0" x2="0" y1="${pad.t}" y2="${H-pad.b}" visibility="hidden"/><circle class="fc-hover-dot" r="5" visibility="hidden"/><rect class="fc-hit" x="${pad.l}" y="${pad.t}" width="${W-pad.l-pad.r}" height="${H-pad.t-pad.b}"/></svg><div class="fc-tip" hidden></div></div>`;
}
function chartHover(e){
  const wrap=e.target.closest?.('[data-fc-chart]');
  document.querySelectorAll('[data-fc-chart]').forEach(w=>{if(w!==wrap){w.querySelector('.fc-tip').hidden=true;w.querySelector('.fc-hover-line')?.setAttribute('visibility','hidden');w.querySelector('.fc-hover-dot')?.setAttribute('visibility','hidden');}});
  if(!wrap||!fc)return;
  const svg=wrap.querySelector('svg'),r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)*900/r.width;
  const pts=[{date:fc.today,expected:fc.startBalance},...fc.days],pl=52,pr=18,i=Math.round(Math.min(1,Math.max(0,(vx-pl)/(900-pl-pr)))*(pts.length-1)),p=pts[i];
  const exp=pts.map(q=>q.expected),step=Math.max(...exp)-Math.min(0,...exp)>2500?1000:500,yMin=Math.min(0,Math.floor(Math.min(...exp)/step)*step),yMax=Math.ceil(Math.max(...exp)*1.08/step)*step;
  const px=pl+(900-pl-pr)*i/(pts.length-1),py=34+(300-34-40)*(1-(p.expected-yMin)/(yMax-yMin));
  const hl=wrap.querySelector('.fc-hover-line'),hd=wrap.querySelector('.fc-hover-dot');
  hl.setAttribute('x1',px);hl.setAttribute('x2',px);hl.setAttribute('visibility','visible');hd.setAttribute('cx',px);hd.setAttribute('cy',py);hd.setAttribute('visibility','visible');
  const evs=fc.events.filter(ev=>ev.date===p.date);
  const tip=wrap.querySelector('.fc-tip');tip.hidden=false;
  tip.innerHTML=`<strong>${i?date(p.date):'Today'}</strong><span>${i?'Estimated balance':'Balance now'} <b class="money">${i?'≈ ':''}${money(p.expected)}</b></span>${evs.map(ev=>`<small>${escape(nice(ev.label))} <b class="money ${ev.amount>0?'positive':''}">${signed(ev.amount)}</b></small>`).join('')}`;
  const left=px*r.width/900;tip.style.left=Math.min(Math.max(left,90),r.width-90)+'px';tip.style.top=(py*r.height/300)+'px';
}
document.addEventListener('mousemove',chartHover);
function weatherStrip(f){return `<div class="fc-weather">${f.weeks.map(w=>`<div class="fc-week ${w.weather}" title="${escape(shortDate(w.start)+'–'+shortDate(w.end)+': lowest about '+money(w.lowest))}"><span>${weatherIcon[w.weather]}</span><small>${shortDate(w.start)}</small></div>`).join('')}</div>`;}
const friendly={'Immo Verhuur Leuven':'Your rent','KBC Autoverzekering':'car insurance','Engie Electrabel':'your energy bill','Telenet':'internet','De Watergroep':'water bill','Holiday season and gifts':'holiday gifts','Orange Belgium':'your phone plan'};
const nice=l=>friendly[l]||l;
const list=xs=>xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs.at(-1);
function riskStory(f){
  const r=f.risk;if(!r)return null;
  const pay=f.events.find(e=>e.kind==='income'&&e.date>=r.from);
  const range=r.from===r.to?shortDate(r.from):`${shortDate(r.from)}–${shortDate(r.to)}`;
  const causes=list(r.causes.slice(0,3).map((c,i)=>{const n=nice(c.label);return `${i?n:n.charAt(0).toUpperCase()+n.slice(1)} (${money(c.amount)})`;}));
  return {range,title:`Money gets tight ${range}`,
    why:`${causes} go out before your ${pay?'salary on '+shortDate(pay.date):'next salary'}. You’d have about ${money(Math.max(0,r.lowestExpected))} left${r.lowestLow<0?', or less than nothing if spending runs a bit high':''}.`};
}
function forecastCard(f,{compact=false}={}){
  const s=riskStory(f),action=f.actions.find(a=>a.id==='bridge');
  const done=action&&action.applied?`<div class="kn-done"><span>✓</span><div><strong>Sorted: ${money(action.amount)} moves from your savings on ${shortDate(action.date)}</strong><small>Your balance stays above your ${money(f.buffer)} buffer in October.</small></div><button class="text-button" data-forecast-undo="bridge">Undo</button></div>`:'';
  if(!s)return done+`<article class="kn-card ok"><span class="kn-icon">☀️</span><div class="kn-body"><span class="kn-eyebrow">Kate Ahead</span><h3>No surprises in the next 90 days</h3><p>Kate keeps watching and will tell you in time if that changes.</p></div></article>`;
  const fix=action&&!action.applied
    ?`<button class="button primary" data-forecast-apply="bridge">Move ${money(action.amount)} from savings on ${shortDate(action.date)}</button>`
    :`<button class="button primary" data-forecast-remind>Remind me 2 weeks before</button>`;
  return done+`<article class="kn-card warn"><span class="kn-icon">${f.risk.severity==='shortfall'?'⛈️':'⛅'}</span><div class="kn-body"><span class="kn-eyebrow">Kate Ahead · spotted ${Math.round((Date.parse(f.risk.from)-Date.parse(f.today))/864e5)} days early</span><h3>${escape(s.title)}</h3><p>${escape(s.why)}</p><div class="kn-actions">${fix}${compact?'<button class="button" data-action="kate-ahead">Details</button>':'<button class="button" data-forecast-dismiss>Not now</button>'}</div></div></article>`;
}
function aheadHero(){
  if(!fc)return fcError?'':`<section class="kn-card loading" role="status"><span class="kate-symbol">✦</span> Kate is looking ahead…</section>`;
  return `<section class="kn-hero">${forecastCard(fc,{compact:true})}</section>`;
}
function forecastSection(){
  if(fcError)return `<div class="panel product-card"><p role="alert">${escape(fcError)}</p><button class="button" id="reload-forecast">Try again</button></div>`;
  if(!fc)return '<div class="panel product-card" role="status">Kate is looking ahead…</div>';
  return `<h2 class="ahead-subtitle first">Needs your attention</h2>${forecastCard(fc)}<div class="kn-stats"><div><span>Safe to spend until payday</span><strong class="money">${money(fc.safeToSpend)}</strong></div><div><span>Next salary</span><strong>${shortDate(fc.nextIncome)}</strong></div><div><span>Your comfort buffer</span><strong class="money">${money(fc.buffer)}</strong></div></div><section class="panel fc-chart-panel"><div class="panel-header"><div><h2>Your estimated balance <span class="estimate-badge">Estimate</span></h2><p class="fc-sub">What Kate expects on your Everyday account over the next 90 days, based on your last 12 months. Your real balance will differ.</p></div><span class="muted">Hover for details</span></div>${forecastChart(fc)}<div class="fc-legend"><span><i class="lg-line"></i>Estimated balance</span><span><i class="lg-danger"></i>Below your buffer</span><span><i class="lg-pay"></i>Payday</span></div></section>`;
}
function forecastDetails(){
  if(!fc)return '';
  const events=fc.events.slice(0,14).map((e,i)=>`<div class="fc-event"><span class="fc-date">${shortDate(e.date)}</span><span class="transaction-info"><strong>${escape(e.label)}</strong><small>${e.kind==='period'?'Expected from last year':e.kind==='income'?'Recurring income':e.kind==='transfer'?'Your approved action':e.kind==='trial'?'Trial converts to paid':e.kind==='renewal'?'Annual renewal':'Recurring bill'}</small></span><span class="amount money ${e.amount>0?'positive':''}">${signed(e.amount)}</span>${e.why?`<button class="text-button" data-forecast-why="${i}">Why?</button>`:'<span></span>'}</div>`).join('');
  return `<details class="panel fc-details"><summary><span><strong>How Kate worked this out</strong><small>The payments and patterns behind these notifications</small></span><span class="kn-chevron">▾</span></summary><div class="fc-details-body"><h3 class="fc-events-title">What Kate expects</h3>${events}<p class="form-note">Estimated from your last 12 months of payments. Estimates, not guarantees.</p></div></details>`;
}
async function forecastAction(apply){
  document.querySelectorAll('[data-forecast-apply],[data-forecast-undo]').forEach(b=>b.disabled=true);
  const before=fc?.risk;
  try{const r=await fetch('/api/forecast/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'bridge',apply})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not apply this action.');fc=j;updateAheadPill();render();
    toast(apply?(fc.risk&&fc.risk.from!==before?.from?`Fixed. Next up: ${shortDate(fc.risk.from)}. Kate will remind you in time.`:'Fixed. The storm is gone.'):'Undone. Demo only, no money moved.');}
  catch(e){toast(e.message);document.querySelectorAll('[data-forecast-apply],[data-forecast-undo]').forEach(b=>b.disabled=false);}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.forecastApply)forecastAction(true);
  if(b.dataset.forecastUndo)forecastAction(false);
  if(b.dataset.forecastRemind!==undefined)toast('Kate will remind you 2 weeks before. Demo only.');if(b.dataset.forecastDismiss!==undefined)toast('Okay. Kate will check again closer to the date.');if(b.id==='reload-forecast'){fcError='';loadForecast();}
  if(b.dataset.forecastWhy){const ev=fc.events.slice(0,14)[Number(b.dataset.forecastWhy)];if(ev)modal(ev.label,`<p>${escape(ev.why||'')}</p><div class="detail-line"><span>Expected on</span><strong>${date(ev.date)}</strong></div><div class="detail-line"><span>Amount</span><strong class="money">${signed(ev.amount)}</strong></div><p class="form-note">Detected by the expense pattern engine from the payment history. Estimates, not guarantees.</p>`);}
  if(b.id==='ahead-pill')navigate('kate-ahead');
  if(b.dataset.openAhead!==undefined){$('#kate-panel').hidden=true;navigate('kate-ahead');}
});
function render(){view=location.hash.slice(1)||'overview';if(!nav.some(n=>n[0]===view))view='overview';$('#breadcrumb').textContent=nav.find(n=>n[0]===view)[1];document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('#main').innerHTML=({overview,accounts:accountsPage,payments:paymentsPage,cards:cardsPage,insurance:insurancePage,investments:investmentsPage,documents:documentsPage,'kate-ahead':aheadPage}[view])();}
function navigate(v){if(location.hash==='#'+v)render();else location.hash=v;}
function modal(title,content){$('#modal-title').textContent=title;$('#modal-content').innerHTML=content;$('#modal').showModal();}
function toast(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000);}
function transfer(){modal('Make a demo transfer',`<form id="transfer-form"><label class="form-field">From account<select name="from">${accounts.map(a=>`<option value="${a.id}">${a.name} · ${money(a.balance)}</option>`).join('')}</select></label><label class="form-field">To account<select name="to"><option value="savings">A little peace of mind</option><option value="joint">Our household</option><option value="current">Everyday account</option></select></label><label class="form-field">Amount (€)<input name="amount" type="number" min="0.01" max="100000" step="0.01" placeholder="0.00" required></label><label class="form-field">Message <span class="muted">(optional)</span><input name="message" maxlength="100" placeholder="What is this transfer for?"></label><p class="form-note">This moves fictional money between your demo accounts. No real payment is made.</p><p class="form-error" id="transfer-error" aria-live="polite"></p><button class="button primary full">Review transfer</button></form>`);}
function download(name,content,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function details(t){modal(t.merchant,`<div class="detail-amount money ${t.amount>0?'positive':''}">${signed(t.amount)}</div>${[['Date',date(t.date)],['Account',accounts.find(a=>a.id===t.account).name],['Type',t.method],['Category',t.category],['Message',t.reference],['Status','Completed · demo']].map(([k,v])=>`<div class="detail-line"><span>${k}</span><strong>${escape(v)}</strong></div>`).join('')}`);}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.action){const a=b.dataset.action;if(a==='transfer')transfer();else if(a==='kate')$('#kate-panel').hidden=false;else if(a==='transactions'){filterAccount='all';search='';navigate('accounts');}else if(a==='export'){const quote=s=>'"'+String(s).replaceAll('"','""')+'"';const rows=transactions.filter(t=>(filterAccount==='all'||t.account===filterAccount)&&`${t.merchant} ${t.category} ${t.reference}`.toLowerCase().includes(search.toLowerCase()));download('kbc-demo-transactions.csv','Date,Merchant,Account,Amount EUR,Category,Message\n'+rows.map(t=>[t.date,t.merchant,t.account,t.amount,t.category,t.reference].map(quote).join(',')).join('\n'),'text/csv');}else navigate(a);}if(b.dataset.account){const a=accounts.find(a=>a.id===b.dataset.account);modal(a.name,`<div class="detail-amount money">${money(a.balance)}</div><div class="detail-line"><span>Product</span><strong>${a.product}</strong></div><div class="detail-line"><span>Account reference</span><strong>${a.number}</strong></div><div class="detail-line"><span>Account holder</span><strong>${customer.name}</strong></div><p class="muted" style="font-size:13px">All account details are fictional.</p><button class="button primary full" id="account-transactions" data-id="${a.id}">View transactions</button>`);}if(b.id==='account-transactions'){$('#modal').close();filterAccount=b.dataset.id;search='';navigate('accounts');}if(b.dataset.tx)details(transactions.find(t=>t.id===Number(b.dataset.tx)));if(b.dataset.tab){paymentTab=b.dataset.tab;render();}if(b.dataset.freeze){const c=cards.find(c=>c.id===b.dataset.freeze);c.frozen=!c.frozen;render();toast(c.frozen?'Demo card frozen. You can unfreeze it here.':'Demo card is ready to use again.');}if(b.dataset.schedule){const s=scheduled[Number(b.dataset.schedule)];modal(s.name,`<div class="detail-amount money">${money(s.amount)}</div><div class="detail-line"><span>Scheduled for</span><strong>${date(s.date)}</strong></div><div class="detail-line"><span>From</span><strong>${accounts.find(a=>a.id===s.account).name}</strong></div><div class="detail-line"><span>Type</span><strong>${s.method}</strong></div><p class="form-note">This is a fictional scheduled payment.</p>`);}if(b.dataset.policy){modal('Demo insurance policy',`<p>Policy reference: <strong>${b.dataset.policy}</strong></p><p>This fictional policy is included as a starting point for future insurance prototype flows.</p><p class="form-note">No real cover or contract is provided.</p>`);}if(b.dataset.document){const type=b.dataset.document;if(type==='statement'){download('kbc-demo-statement-september.txt','KBC-INSPIRED DEMO — NOT A REAL BANK STATEMENT\nCustomer: '+customer.name+'\nAccount: Everyday account\n\n'+transactions.filter(t=>t.account==='current').map(t=>`${t.date} | ${t.merchant} | ${signed(t.amount)}`).join('\n'));}else download('kbc-demo-'+type+'-policy.txt','KBC-INSPIRED DEMO — FICTIONAL POLICY\n'+type+' insurance\nCustomer: '+customer.name+'\nNo real cover or contract is provided.');toast('Demo document downloaded.');}});
document.addEventListener('input',e=>{if(e.target.id==='transaction-search'){search=e.target.value;$('#transaction-list').innerHTML=txList(view==='overview'?5:100);}});
document.addEventListener('change',e=>{if(e.target.id==='account-filter'){filterAccount=e.target.value;$('#transaction-list').innerHTML=txList(view==='overview'?5:100);}});
document.addEventListener('submit',e=>{if(e.target.id!=='transfer-form')return;e.preventDefault();const f=new FormData(e.target);const from=accounts.find(a=>a.id===f.get('from')),to=accounts.find(a=>a.id===f.get('to'));const amount=Number(f.get('amount'));if(from===to||!Number.isFinite(amount)||amount<=0||Math.round(amount*100)>Math.round(from.balance*100)){$('#transfer-error').textContent=from===to?'Choose two different accounts.':'Enter a valid amount within your available balance.';return;}const reference=String(f.get('message')).trim()||'Demo transfer';$('#modal-content').innerHTML=`<div class="detail-amount">${money(amount)}</div><div class="detail-line"><span>From</span><strong>${from.name}</strong></div><div class="detail-line"><span>To</span><strong>${to.name}</strong></div><div class="detail-line"><span>Message</span><strong>${escape(reference)}</strong></div><p class="form-note">Only fictional account balances will change.</p><button class="button primary full" id="confirm-transfer">Confirm demo transfer</button>`;$('#confirm-transfer').onclick=()=>{from.balance=Math.round((from.balance-amount)*100)/100;to.balance=Math.round((to.balance+amount)*100)/100;const id=Math.max(...transactions.map(t=>t.id))+1;transactions.unshift({id,account:from.id,merchant:to.name,category:'Transfers',date:'2026-09-30',amount:-amount,icon:'transfer',color:'blue',method:'Demo bank transfer',reference},{id:id+1,account:to.id,merchant:from.name,category:'Transfers',date:'2026-09-30',amount,icon:'transfer',color:'teal',method:'Demo bank transfer',reference});$('#modal').close();render();toast('Demo transfer completed. Account balances updated.');};});
$('#close-modal').onclick=()=>$('#modal').close();$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#privacy').onclick=()=>{hidden=!hidden;document.body.classList.toggle('hide-amounts',hidden);$('#privacy').setAttribute('aria-label',hidden?'Show balances':'Hide balances');$('#privacy').setAttribute('aria-pressed',String(hidden));};
$('#notifications').onclick=()=>modal('Your notifications',(fc&&fc.risk?`<div class="detail-line"><span>✦ Kate Ahead</span><strong>${escape(riskStory(fc).title)} <button class="text-button" data-open-ahead>View</button></strong></div>`:'')+'<div class="detail-line"><span>Today</span><strong>Your September statement is ready.</strong></div><div class="detail-line"><span>Tomorrow</span><strong>Rent payment · '+money(780)+'</strong></div><p class="form-note">These notifications are part of the demo.</p>');
$('#help-button').onclick=()=>modal('Help & contact','<p>Explore the demo with Kate, or open any account to view its transactions.</p><p class="form-note">This prototype is independent of KBC. It is not connected to banking or support services.</p><button class="button primary full" id="help-kate">Ask Kate</button>');
document.addEventListener('click',e=>{if(e.target.closest('#help-kate')){$('#modal').close();$('#kate-panel').hidden=false;}});
$('#reset').onclick=async()=>{try{const response=await fetch('/api/ahead/reset',{method:'POST'});if(!response.ok)throw new Error('Could not reset the demo. Please try again.');location.reload();}catch(error){toast(error.message);}};$('#kate-launch').onclick=()=>{$('#kate-panel').hidden=!$('#kate-panel').hidden;if(!$('#kate-panel').hidden)$('#chat-input').focus();};$('#close-kate').onclick=()=>$('#kate-panel').hidden=true;
const chatHistory=[];
let chatBusy=false;
function chatBubble(text,kind=''){
  const p=document.createElement('p');
  p.className='chat-bubble'+(kind?' '+kind:'');
  p.textContent=text;
  $('#chat-messages').append(p);
  $('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
  return p;
}
function setChatBusy(busy){
  chatBusy=busy;
  $('#chat-messages').setAttribute('aria-busy',String(busy));
  $('#chat-form button').disabled=busy;
  document.querySelectorAll('[data-question]').forEach(b=>b.disabled=busy);
}
async function ask(q,retry=false){
  if(chatBusy||!q.trim())return;
  if(!retry)chatBubble(q,'user');
  const answer=chatBubble('Kate is thinking…','pending');
  setChatBusy(true);
  try{
    const response=await fetch('/api/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        messages:[...chatHistory.slice(-12),{role:'user',content:q}],
        context:{accounts,transactions:transactions.slice(0,20),cards}
      }),signal:AbortSignal.timeout(60000)
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Kate could not answer. Please try again.');
    if(typeof result.reply!=='string'||!result.reply.trim())throw new Error('Kate returned an empty answer. Please try again.');
    answer.textContent=result.reply;
    answer.classList.remove('pending');
    chatHistory.push({role:'user',content:q},{role:'assistant',content:result.reply});
    if(chatHistory.length>12)chatHistory.splice(0,chatHistory.length-12);
  }catch(error){
    answer.className='chat-bubble chat-error';
    answer.textContent=error.name==='TimeoutError'?'Kate took too long to answer. Please try again.':error.message==='Failed to fetch'?'Could not reach the local chat server. Please try again.':error.message;
    const retryButton=document.createElement('button');
    retryButton.className='text-button chat-retry';
    retryButton.textContent='Try again';
    retryButton.onclick=()=>{if(!chatBusy){answer.remove();ask(q,true);}};
    answer.append(retryButton);
  }finally{
    setChatBusy(false);
    $('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
    if(!$('#kate-panel').hidden)$('#chat-input').focus();
  }
}
$('#chat-form').onsubmit=e=>{e.preventDefault();if(chatBusy)return;const q=$('#chat-input').value.trim();if(q){$('#chat-input').value='';ask(q);}};
document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>ask(b.dataset.question));
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});render();loadForecast();
