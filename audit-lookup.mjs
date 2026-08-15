// Two dictionaries, tried in order, and every way that can go wrong.
import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
const FD='**/api.dictionaryapi.dev/**', WK='**/en.wiktionary.org/**';
const fdBody=JSON.stringify([{word:'love',phonetic:'/lʌv/',meanings:[
  {partOfSpeech:'noun',definitions:[{definition:'A strong feeling of affection.',example:'their love of books'}],synonyms:['adoration']}]}]);
const wkBody=JSON.stringify({en:[
  {partOfSpeech:'Noun',definitions:[
    {definition:'A strong <a href="/wiki/x">feeling</a> of affection.',parsedExamples:[{example:'She showed her <b>love</b>.'}]},
    {definition:'A person who is loved.'}]},
  {partOfSpeech:'Verb',definitions:[{definition:'To have <i>great</i> affection for.'}]}]});
const J=b=>r=>r.fulfill({status:200,contentType:'application/json',body:b});

async function go(routes){
  const ctx=await br.newContext({viewport:{width:400,height:880}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
  await p.addInitScript(()=>{speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{}});
  await p.goto('file:///home/user/Widget/app.html');
  await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
    profile:{name:'T',at:n,streak:1,lastDay:new Date().toDateString()},prefs:{},
    books:[{id:'b1',title:'Test Book',author:'A',page:10,pages:100,genre:'literary',at:n}],
    words:[],quotes:[],notes:[]}))});
  await p.reload(); await p.waitForTimeout(300);
  for(const [pat,fn] of routes) await p.route(pat,fn);
  await p.click('.bookcard'); await p.waitForTimeout(300);
  await p.click('text=+ Add a word'); await p.fill('#w','love');
  await p.click('button:has-text("Look up")'); await p.waitForTimeout(800);
  return p;
}

console.log('\n-- primary works: fallback untouched --');
let called=false;
let p=await go([[FD,J(fdBody)],[WK,r=>{called=true;r.fulfill({status:200,body:'{}'})}]]);
let t=await p.textContent('#lk');
ok('uses Free Dictionary', t.includes('Free Dictionary'));
ok('keeps phonetic', t.includes('/lʌv/'));
ok('keeps synonyms', t.includes('adoration'));
ok('fallback never called', !called);
ok('offers real-speaker audio links', await p.isVisible('#lk a:has-text("Real speakers")'));
await p.context().close();

console.log('\n-- primary down: falls back --');
p=await go([[FD,r=>r.abort()],[WK,J(wkBody)]]);
t=await p.textContent('#lk');
ok('falls through to Wiktionary', t.includes('Wiktionary'));
ok('HTML stripped from definition', t.includes('A strong feeling of affection')&&!t.includes('<a href'));
ok('both parts of speech parsed', t.includes('noun')&&t.includes('verb'));
ok('example stripped of markup', t.includes('She showed her love.'));
await p.click('.sense >> nth=0');
ok('tap-to-keep works from fallback', (await p.inputValue('#m')).includes('noun — A strong feeling of affection'));
await p.context().close();

console.log('\n-- primary 404, fallback has it --');
p=await go([[FD,r=>r.fulfill({status:404,body:'{}'})],[WK,J(wkBody)]]);
ok('still found', (await p.textContent('#lk')).includes('Wiktionary'));
await p.context().close();

console.log('\n-- both 404 --');
p=await go([[FD,r=>r.fulfill({status:404,body:'{}'})],[WK,r=>r.fulfill({status:404,body:'{}'})]]);
t=await p.textContent('#lk');
ok('says no entry', t.includes('No entry for'));
ok('names both dictionaries', t.includes('Neither dictionary'));
await p.context().close();

console.log('\n-- both unreachable --');
p=await go([[FD,r=>r.abort()],[WK,r=>r.abort()]]);
t=await p.textContent('#lk');
ok('says the page blocked it', t.includes('This page blocked the lookup'));
ok('does NOT claim not-a-word', !t.includes('No entry for'));
ok('still offers a way to hear it', await p.isVisible('#lk a'));
await p.context().close();

console.log('\n-- malformed and empty responses --');
p=await go([[FD,r=>r.fulfill({status:200,contentType:'application/json',body:'{{{'})],[WK,J(wkBody)]]);
ok('garbage JSON falls through', (await p.textContent('#lk')).includes('Wiktionary'));
await p.context().close();
p=await go([[FD,J(JSON.stringify([{word:'love',meanings:[]}]))],[WK,J(wkBody)]]);
ok('empty-but-valid falls through', (await p.textContent('#lk')).includes('Wiktionary'));
await p.context().close();
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
