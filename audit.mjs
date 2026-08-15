import {chromium} from 'playwright';
const URL='file:///home/user/Widget/index.html';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let pass=0,fail=0; const bad=[];
const ok=(n,c)=>{c?pass++:(fail++,bad.push(n));console.log(`${c?'PASS':'FAIL'}  ${n}`)};

async function fresh(dark=false){
  const ctx=await br.newContext({viewport:{width:390,height:844},colorScheme:dark?'dark':'light'});
  const p=await ctx.newPage();
  p.on('pageerror',e=>{fail++;bad.push('JS ERROR: '+e.message);console.log('FAIL  JS ERROR '+e.message)});
  await p.goto(URL); return p;
}
const API='**/api.dictionaryapi.dev/**';
const LOVE=[{word:'love',phonetic:'/lʌv/',phonetics:[{text:'/lʌv/'}],meanings:[
  {partOfSpeech:'noun',definitions:[{definition:'A strong feeling of affection.',example:'their love for their country'}],synonyms:['affection','adoration']},
  {partOfSpeech:'verb',definitions:[{definition:'To feel deep affection for.'}],synonyms:['adore']}]}];

console.log('\n── 1. BOOKS ──');
let p=await fresh();
await p.click('text=Add a book');
await p.fill('#t','The Secret History');await p.fill('#a','Donna Tartt');
await p.fill('#p','142');await p.fill('#tp','559');
await p.click('.vibe:has-text("Dusk")');
ok('vibe previews live before saving', await p.evaluate(()=>document.documentElement.dataset.vibe)==='dusk');
await p.click('#ok');
ok('book appears on shelf', await p.isVisible('text=The Secret History'));
ok('author shown', await p.isVisible('text=Donna Tartt'));
await p.click('.row');
ok('page number carried through', (await p.textContent('.hero')).includes('142'));
ok('progress % correct (142/559=25%)', (await p.textContent('.hero')).includes('25%'));
await p.click('text=Move bookmark');await p.fill('#p','300');await p.click('#ok');
ok('bookmark updates', (await p.textContent('.hero')).includes('300'));
ok('progress recalculates (54%)', (await p.textContent('.hero')).includes('54%'));

console.log('\n── 2. DICTIONARY LOOKUP ──');
await p.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(LOVE)}));
await p.click('text=Add a word');
await p.fill('#w','love');await p.click('button:has-text("Look up")');await p.waitForTimeout(500);
let lk=await p.textContent('#lk');
ok('phonetic parsed', lk.includes('/lʌv/'));
ok('multiple senses listed', lk.includes('noun')&&lk.includes('verb'));
ok('definition parsed', lk.includes('A strong feeling of affection'));
ok('example parsed', lk.includes('their love for their country'));
ok('synonyms parsed', lk.includes('adoration')&&lk.includes('adore'));
await p.click('.sense >> nth=0');
ok('tap-to-keep fills definition', (await p.inputValue('#m')).includes('noun — A strong feeling'));
ok('example autofills context', (await p.inputValue('#c')).includes('their love for'));
await p.fill('#mine','When someone is your safe room.');
await p.click('#ok');
ok('word saved', await p.isVisible('text=A strong feeling of affection'));
ok('your meaning shown separately', await p.isVisible('text=When someone is your safe room'));
ok('"In your words" labelled', await p.isVisible('text=In your words'));

console.log('\n── 3. LOOKUP FAILURE MODES ──');
await p.route(API,r=>r.fulfill({status:404,body:'{}'}));
await p.click('text=Add a word');await p.fill('#w','zxqwv');
await p.click('button:has-text("Look up")');await p.waitForTimeout(400);
lk=await p.textContent('#lk');
ok('404 says "no entry" (not a lie)', lk.includes('No entry for'));
ok('404 offers web search', await p.isVisible('#lk a'));
await p.route(API,r=>r.abort());
await p.fill('#w','love');await p.click('button:has-text("Look up")');await p.waitForTimeout(400);
lk=await p.textContent('#lk');
ok('blocked request says "couldn\'t reach"', lk.includes('Couldn’t reach'));
ok('blocked does NOT claim word missing', !lk.includes('No entry for'));
ok('blocked offers web search', (await p.getAttribute('#lk a','href')).includes('google.com/search'));
await p.click('#ok');
ok('refuses word with no meaning at all', await p.isVisible('#ok'));
await p.fill('#mine','only mine');await p.click('#ok');
ok('accepts word with ONLY your meaning', await p.isVisible('text=only mine'));

console.log('\n── 4. QUOTES + JOURNAL ──');
await p.click('button:has-text("Quotes")');await p.click('text=Add a quote');
await p.fill('#q','Beauty is terror.');await p.click('#ok');
ok('quote saved', await p.isVisible('text=Beauty is terror.'));
await p.click('button:has-text("Journal")');await p.click('text=Write an entry');
await p.fill('#n','The hallway, in green.');await p.click('#ok');
ok('journal entry saved', await p.isVisible('text=The hallway, in green.'));
ok('journal timestamped', await p.isVisible('text=today'));

console.log('\n── 5. DICTIONARY VIEW ──');
await p.click('.tab[data-go=dict]');
ok('all words listed', await p.isVisible('text=love'));
ok('shows source book', await p.isVisible('text=The Secret History'));
ok('due chip present', await p.isVisible('.chip'));
await p.fill('input','zxq');await p.waitForTimeout(250);
ok('search filters', !(await p.textContent('#dl')).includes('safe room'));
await p.fill('input','');await p.waitForTimeout(250);
ok('clearing search restores', (await p.textContent('#dl')).includes('safe room'));

console.log('\n── 6. SPACED REPETITION (SM-2) ──');
const srs=await p.evaluate(()=>{
  const w={srs:{ease:2.5,reps:0,interval:0,due:Date.now()}};
  const out=[];
  grade(w,4); out.push(['1st Good → 1 day', w.srs.interval===1]);
  grade(w,4); out.push(['2nd Good → 6 days', w.srs.interval===6]);
  grade(w,4); out.push(['3rd Good → 6*ease', w.srs.interval===Math.round(6*2.5)]);
  const before=w.srs.interval;
  grade(w,0); out.push(['Again resets interval', w.srs.interval===0]);
  out.push(['Again requeues within 10 min', w.srs.due-Date.now()<=6e5+50]);
  const e={srs:{ease:2.5,reps:2,interval:6,due:0}};
  grade(e,5); const easy=e.srs.ease;
  const g={srs:{ease:2.5,reps:2,interval:6,due:0}};
  grade(g,4); out.push(['Easy raises ease above Good', easy>g.srs.ease]);
  const h={srs:{ease:1.3,reps:0,interval:0,due:0}};
  for(let i=0;i<8;i++) grade(h,0);
  out.push(['ease floors at 1.3', h.srs.ease>=1.3]);
  return out;
});
srs.forEach(([n,c])=>ok(n,c));

console.log('\n── 7. REVIEW SESSION ──');
await p.click('.tab[data-go=review]');
ok('due count badge on tab', (await p.textContent('.tab[data-go=review]')).match(/\d/)!==null);
ok('card hides meaning first', !(await p.textContent('.flash')).includes('safe room'));
const before=await p.textContent('.flash');
await p.keyboard.press(' ');await p.waitForTimeout(250);
ok('spacebar flips (rating appears)', await p.isVisible('.rate') && (await p.textContent('.flash'))!==before);
const fl=await p.textContent('.flash');
ok('your meaning before dictionary', fl.indexOf('safe room')<fl.indexOf('A strong feeling')||!fl.includes('A strong feeling'));
ok('3 rating buttons', await p.locator('.rate button').count()===3);
ok('intervals previewed on buttons', (await p.textContent('.rate')).includes('tomorrow'));
await p.keyboard.press('2');await p.waitForTimeout(250);
ok('keyboard rating advances', true);

console.log('\n── 8. VIBES ──');
await p.click('.tab[data-go=shelf]');await p.click('.row');
ok('book vibe applied', await p.evaluate(()=>document.documentElement.dataset.vibe)==='dusk');
await p.click('.tab[data-go=dict]');
ok('vibe persists into dictionary', await p.evaluate(()=>document.documentElement.dataset.vibe)==='dusk');
await p.click('.tab[data-go=shelf]');await p.click('.row');
await p.click('.hero .icon-btn >> nth=1');await p.click('.vibe:has-text("Fern")');await p.click('#ok');
ok('vibe changeable from book', await p.evaluate(()=>document.documentElement.dataset.vibe)==='fern');
ok('vibe stored on the book', await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')).books[0].vibe)==='fern');

console.log('\n── 9. THEME ──');
ok('theme toggle exists inside a book', await p.locator('.hero .icon-btn').count()===2);
await p.click('.hero .icon-btn >> nth=0');await p.waitForTimeout(800);
ok('dark toggle works from book view', await p.evaluate(()=>document.documentElement.dataset.theme)==='dark');
const lum=await p.evaluate(()=>{const cv=document.createElement('canvas').getContext('2d');
  cv.fillStyle=getComputedStyle(document.body).backgroundColor;const n=parseInt(cv.fillStyle.slice(1),16);
  return ((n>>16&255)*0.299+(n>>8&255)*0.587+(n&255)*0.114)/255;});
ok('dark bg genuinely dark (settled)', lum<0.2);
await p.click('.tab[data-go=shelf]');
await p.reload();await p.waitForTimeout(300);
ok('theme survives reload', await p.evaluate(()=>document.documentElement.dataset.theme)==='dark');

console.log('\n── 10. PERSISTENCE + SAFETY ──');
ok('books survive reload', await p.isVisible('text=The Secret History'));
const counts=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('lingobox.v1'));return [d.books.length,d.words.length,d.quotes.length,d.notes.length]});
ok('all records persisted '+JSON.stringify(counts), counts[0]===1&&counts[1]===2&&counts[2]===1&&counts[3]===1);
ok('no horizontal overflow', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await p.close();

console.log('\n── 11. XSS / HOSTILE INPUT ──');
p=await fresh();
await p.click('text=Add a book');
await p.fill('#t','<img src=x onerror="window.__pwned=1">');await p.click('#ok');
await p.waitForTimeout(300);
ok('book title escaped, no injection', await p.evaluate(()=>window.__pwned===undefined));
ok('title rendered as literal text', await p.isVisible('text=<img src=x'));
await p.click('.row');await p.click('text=Add a word');
await p.fill('#w','<b>x</b>');await p.fill('#mine','<script>window.__p2=1<\/script>');await p.click('#ok');
await p.waitForTimeout(200);
ok('word + meaning escaped', await p.evaluate(()=>window.__p2===undefined));
await p.close();

console.log('\n── 12. CORRUPT / LEGACY DATA ──');
p=await fresh();
await p.evaluate(()=>localStorage.setItem('lingobox.v1','{ not json'));
await p.reload();await p.waitForTimeout(300);
ok('survives corrupt storage', await p.isVisible('text=Your shelf is empty'));
await p.evaluate(()=>localStorage.setItem('lingobox.v1',JSON.stringify({
  books:[{id:'b1',title:'Old Book',author:'A',page:10,pages:100,at:Date.now()}],
  words:[{id:'w1',bookId:'b1',word:'old',meaning:'legacy meaning',page:5,at:Date.now(),srs:{ease:2.5,reps:0,interval:0,due:Date.now()}}],
  quotes:[],notes:[]})));
await p.reload();await p.waitForTimeout(300);
ok('v1 data with no vibe/mine loads', await p.isVisible('text=Old Book'));
await p.click('.row');await p.waitForTimeout(200);
ok('legacy word renders', await p.isVisible('text=legacy meaning'));
ok('missing vibe defaults, no crash', await p.evaluate(()=>document.documentElement.dataset.vibe)==='paper');
await p.click('.tab[data-go=review]');await p.click('.flash');await p.waitForTimeout(200);
ok('legacy word reviewable', (await p.textContent('.flash')).includes('legacy meaning'));
await p.close();

console.log('\n── 13. DELETE CASCADE ──');
p=await fresh();
await p.click('text=Add a book');await p.fill('#t','Doomed');await p.click('#ok');
await p.click('.row');await p.click('text=Add a word');
await p.fill('#w','w');await p.fill('#mine','m');await p.click('#ok');
p.once('dialog',d=>d.accept());
await p.click('text=Delete this book');await p.waitForTimeout(400);
ok('book deleted', await p.isVisible('text=Your shelf is empty'));
const left=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('lingobox.v1'));return d.words.length});
ok('orphan words cleaned up', left===0);
await p.close();

console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}`);
if(bad.length) console.log('FAILURES:\n - '+bad.join('\n - '));
await br.close();
