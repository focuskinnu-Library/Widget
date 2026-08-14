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

async function go(routes){
  const ctx=await br.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>{fail++;console.log('FAIL  JS ERROR '+e.message)});
  await p.goto('file:///home/user/Widget/index.html');
  for(const [pat,fn] of routes) await p.route(pat,fn);
  await p.click('text=Add a book');await p.fill('#t','B');await p.click('#ok');
  await p.click('.row');await p.click('text=Add a word');
  await p.fill('#w','love');await p.click('button:has-text("Look up")');await p.waitForTimeout(700);
  return p;
}
const J=b=>r=>r.fulfill({status:200,contentType:'application/json',body:b});

console.log('\n-- primary works: Wiktionary never called --');
let called=false;
let p=await go([[FD,J(fdBody)],[WK,r=>{called=true;r.fulfill({status:200,body:'{}'})}]]);
let t=await p.textContent('#lk');
ok('uses Free Dictionary', t.includes('Free Dictionary'));
ok('keeps phonetic', t.includes('/lʌv/'));
ok('keeps synonyms', t.includes('adoration'));
ok('fallback not called', !called);
await p.context().close();

console.log('\n-- primary DOWN: falls back to Wiktionary --');
p=await go([[FD,r=>r.abort()],[WK,J(wkBody)]]);
t=await p.textContent('#lk');
ok('falls through to Wiktionary', t.includes('Wiktionary'));
ok('HTML tags stripped from definition', t.includes('A strong feeling of affection') && !t.includes('<a href'));
ok('multiple senses parsed', t.includes('noun') && t.includes('verb'));
ok('example stripped of markup', t.includes('She showed her love.'));
await p.click('.sense >> nth=0');
ok('tap-to-keep works from fallback', (await p.inputValue('#m')).includes('noun — A strong feeling of affection'));
await p.context().close();

console.log('\n-- primary 404 but Wiktionary has it --');
p=await go([[FD,r=>r.fulfill({status:404,body:'{}'})],[WK,J(wkBody)]]);
ok('404 on primary still finds it', (await p.textContent('#lk')).includes('Wiktionary'));
await p.context().close();

console.log('\n-- both 404: honestly "no entry" --');
p=await go([[FD,r=>r.fulfill({status:404,body:'{}'})],[WK,r=>r.fulfill({status:404,body:'{}'})]]);
t=await p.textContent('#lk');
ok('says no entry', t.includes('No entry for'));
ok('mentions neither has it', t.includes('Neither dictionary'));
await p.context().close();

console.log('\n-- both unreachable: network, not vocabulary --');
p=await go([[FD,r=>r.abort()],[WK,r=>r.abort()]]);
t=await p.textContent('#lk');
ok('says couldn\'t reach', t.includes('Couldn’t reach any dictionary'));
ok('does NOT claim not-a-word', !t.includes('No entry for'));
ok('offers web search', await p.isVisible('#lk a'));
await p.context().close();

console.log('\n-- malformed JSON from primary, good fallback --');
p=await go([[FD,r=>r.fulfill({status:200,contentType:'application/json',body:'{{{not json'})],[WK,J(wkBody)]]);
ok('survives garbage and falls through', (await p.textContent('#lk')).includes('Wiktionary'));
await p.context().close();

console.log('\n-- primary 200 but empty senses -> fallback --');
p=await go([[FD,J(JSON.stringify([{word:'love',meanings:[]}]))],[WK,J(wkBody)]]);
ok('empty result falls through', (await p.textContent('#lk')).includes('Wiktionary'));
await p.context().close();

console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
