import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
async function go(offline){
  const ctx=await br.newContext({viewport:{width:400,height:880}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
  await p.goto('file:///home/user/Widget/app.html');
  await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
    profile:{name:'T',at:n,streak:1,lastDay:new Date().toDateString()},prefs:{},
    books:[{id:'b1',title:'B',author:'A',page:1,pages:10,genre:'literary',at:n}],words:[],quotes:[],notes:[]}))});
  await p.reload(); await p.waitForTimeout(300);
  await p.route('**/api.dictionaryapi.dev/**',r=>r.abort());
  await p.route('**/en.wiktionary.org/**',r=>r.abort());
  if(offline) await ctx.setOffline(true);
  await p.click('.bookcard'); await p.waitForTimeout(300);
  await p.click('text=+ Add a word'); await p.fill('#w','fancy');
  await p.click('button:has-text("Look up")'); await p.waitForTimeout(700);
  return p;
}
console.log('-- connected, but the page blocks it --');
let p=await go(false); let t=await p.textContent('#lk');
ok('says the PAGE blocked it', t.includes('This page blocked the lookup'));
ok('reassures the connection is fine', t.includes('Your connection is fine'));
ok('does NOT say you are offline', !t.includes('You’re offline'));
ok('tells you what actually fixes it', t.includes('own address'));
ok('still offers real speakers', await p.isVisible('#lk a:has-text("Real speakers")'));
await p.context().close();
console.log('\n-- genuinely offline --');
p=await go(true); t=await p.textContent('#lk');
ok('says you are offline', t.includes('You’re offline'));
ok('does not blame the page', !t.includes('This page blocked'));
await p.context().close();
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
