import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
const FD='**/api.dictionaryapi.dev/**', WK='**/en.wiktionary.org/**';
async function go(word,wkBody,wkStatus=200){
  const ctx=await br.newContext({viewport:{width:400,height:880}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
  await p.addInitScript(()=>{speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{}});
  await p.goto('file:///home/user/Widget/app.html');
  await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
    profile:{name:'T',at:n,streak:1,lastDay:new Date().toDateString()},prefs:{},
    books:[{id:'b1',title:'B',author:'A',page:1,pages:10,genre:'romance',at:n}],words:[],quotes:[],notes:[]}))});
  await p.reload(); await p.waitForTimeout(300);
  await p.route(FD,r=>r.fulfill({status:404,body:'{}'}));
  await p.route(WK,r=>r.fulfill({status:wkStatus,contentType:'application/json',body:wkBody}));
  await p.click('.bookcard'); await p.waitForTimeout(300);
  await p.click('text=+ Add a word'); await p.fill('#w',word);
  await p.click('button:has-text("Look up")'); await p.waitForTimeout(700);
  return p;
}
console.log('-- a Hindi word: English section empty, hi has it --');
let p=await go('pyar',JSON.stringify({hi:[{partOfSpeech:'Noun',language:'Hindi',
  definitions:[{definition:'<b>love</b>, affection'},{definition:'a term of endearment'}]}]}));
let t=await p.textContent('#lk');
ok('finds it in Hindi', t.includes('love, affection'));
ok('names the language', t.includes('Wiktionary · Hindi'));
ok('markup stripped', !t.includes('<b>'));
await p.click('.sense >> nth=0');
ok('tap-to-keep works', (await p.inputValue('#m')).includes('love, affection'));
await p.context().close();

console.log('\n-- English still wins when it has the word --');
p=await go('love',JSON.stringify({
  en:[{partOfSpeech:'Noun',definitions:[{definition:'A strong feeling of affection.'}]}],
  hi:[{partOfSpeech:'Noun',definitions:[{definition:'something else entirely'}]}]}));
t=await p.textContent('#lk');
ok('prefers English', t.includes('A strong feeling of affection')&&!t.includes('something else'));
ok('no language tag for English', !t.includes('·  '));
await p.context().close();

console.log('\n-- an English section that exists but is empty --');
p=await go('pyar',JSON.stringify({en:[{partOfSpeech:'Noun',definitions:[]}],
  ur:[{partOfSpeech:'Noun',definitions:[{definition:'love'}]}]}));
ok('skips the empty English section', (await p.textContent('#lk')).includes('Urdu'));
await p.context().close();

console.log('\n-- genuinely nowhere --');
p=await go('zzqqxx',JSON.stringify({}),404);
t=await p.textContent('#lk');
ok('says no entry', t.includes('No entry for'));
ok('explains why, without blaming the word', t.includes('strongest in English'));
ok('offers a web search', await p.isVisible('#lk a:has-text("Search the web")'));
const g=await p.getAttribute('#lk a:has-text("Search the web")','href');
ok('web search is for the meaning', g.includes('zzqqxx%20meaning'));
await p.context().close();
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
