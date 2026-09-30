// Fictional fixtures. These are deliberately kept separate for future prototype flows.
export const customer = { name: 'Alex Vermeulen', firstName: 'Alex' };
export const accounts = [
  {id:'current',name:'Everyday account',product:'KBC Plus Account',number:'DEMO •••• 4821',balance:2846.32,type:'Current account',icon:'wallet',color:'blue'},
  {id:'savings',name:'A little peace of mind',product:'KBC Savings Account',number:'DEMO •••• 9016',balance:12450,type:'Savings account',icon:'savings',color:'teal'},
  {id:'joint',name:'Our household',product:'KBC Joint Account',number:'DEMO •••• 7364',balance:1638.75,type:'Joint account',icon:'home',color:'purple'}
];
export const transactions = [
 {id:11,account:'current',merchant:'Spotify',category:'Subscriptions',date:'2026-08-28',amount:-11.99,icon:'music',color:'green',method:'Direct debit',reference:'Spotify Premium'},
 {id:12,account:'current',merchant:'Spotify',category:'Subscriptions',date:'2026-07-28',amount:-11.99,icon:'music',color:'green',method:'Direct debit',reference:'Spotify Premium'},
 {id:13,account:'current',merchant:'Disney+',category:'Subscriptions',date:'2025-11-18',amount:-89.90,icon:'music',color:'purple',method:'Debit card',reference:'Annual subscription'},
 {id:14,account:'current',merchant:'DISNEY PLUS',category:'Subscriptions',date:'2024-11-18',amount:-89.90,icon:'music',color:'purple',method:'Debit card',reference:'Annual subscription'},
 {id:15,account:'current',merchant:'Amazon Prime',category:'Verification',date:'2026-09-19',amount:0,icon:'card',color:'orange',method:'Card verification',reference:'Fictional trial verification'},
 {id:1,account:'current',merchant:'Delhaize',category:'Groceries',date:'2026-09-30',amount:-58.42,icon:'basket',color:'green',method:'Debit card',reference:'Weekly groceries'},
 {id:2,account:'current',merchant:'NMBS / SNCB',category:'Transport',date:'2026-09-30',amount:-12.80,icon:'train',color:'blue',method:'Debit card',reference:'Train ticket · Brussels–Leuven'},
 {id:3,account:'current',merchant:'Studio North',category:'Salary',date:'2026-09-29',amount:2850,icon:'work',color:'teal',method:'Bank transfer',reference:'Salary · September 2026'},
 {id:4,account:'current',merchant:'Bar Noord',category:'Food & drinks',date:'2026-09-29',amount:-18.50,icon:'coffee',color:'orange',method:'Debit card',reference:'Card payment · Antwerp'},
 {id:5,account:'current',merchant:'Spotify',category:'Subscriptions',date:'2026-09-28',amount:-11.99,icon:'music',color:'green',method:'Direct debit',reference:'Spotify Premium'},
 {id:6,account:'joint',merchant:'Colruyt',category:'Groceries',date:'2026-09-28',amount:-86.24,icon:'basket',color:'green',method:'Debit card',reference:'Household groceries'},
 {id:7,account:'savings',merchant:'Monthly savings',category:'Savings',date:'2026-09-25',amount:250,icon:'savings',color:'teal',method:'Standing order',reference:'From Everyday account'},
 {id:8,account:'current',merchant:'Monthly savings',category:'Savings',date:'2026-09-25',amount:-250,icon:'savings',color:'teal',method:'Standing order',reference:'To A little peace of mind'},
 {id:9,account:'joint',merchant:'Luminus',category:'Utilities',date:'2026-09-24',amount:-94,icon:'bolt',color:'orange',method:'Direct debit',reference:'Energy advance · September'},
 {id:10,account:'current',merchant:'Telenet',category:'Utilities',date:'2026-09-23',amount:-59.90,icon:'wifi',color:'purple',method:'Direct debit',reference:'Internet subscription'}
];
// Fictional contract facts for the prototype, not actual provider prices or terms.
export const subscriptionTerms = {
  'disney+': {noticeDays:7,confirmed:true,source:'Customer-confirmed demo renewal and notice period'},
  'amazon prime': {trialDays:14,paidAmount:15,cadence:'monthly',confirmed:true,source:'Customer-confirmed demo trial terms',transactionId:15}
};
export const scheduled = [
 {name:'Rent · October',date:'2026-10-01',amount:780,account:'joint',method:'Standing order',icon:'home'},
 {name:'Monthly savings',date:'2026-10-05',amount:250,account:'current',method:'Standing order',icon:'savings'},
 {name:'Telenet',date:'2026-10-07',amount:59.90,account:'current',method:'Direct debit',icon:'wifi'}
];
export const cards = [
 {id:'debit',name:'KBC Debit Card',holder:'ALEX VERMEULEN',number:'••••  ••••  ••••  4821',expiry:'08/29',account:'current',frozen:false,limit:2500,spent:684.20},
 {id:'credit',name:'KBC Credit Card',holder:'ALEX VERMEULEN',number:'••••  ••••  ••••  6158',expiry:'04/28',account:'current',frozen:false,limit:2000,spent:342.80}
];
