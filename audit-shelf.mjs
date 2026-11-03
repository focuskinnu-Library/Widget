import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:400,height:900}});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
await p.addInitScript(()=>{speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{}});
// keep the service worker out of it, so route interception stays honest
await p.route('**/sw.js',r=>r.abort());
// no network at all — the built-in dictionary must carry it
await p.route('**/api.dictionaryapi.dev/**',r=>r.abort());
await p.route('**/en.wiktionary.org/**',r=>r.abort());
await p.route('**/openlibrary.org/**',r=>r.abort());
await p.goto('http://127.0.0.1:8777/app.html');

console.log('── BUILT-IN DICTIONARY (network dead) ──');
await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
  profile:{name:'Kinnari',at:n-9*864e5,streak:9,lastDay:new Date().toDateString()},prefs:{},
  books:[{id:'b1',title:'The Secret History',author:'Donna Tartt',page:142,pages:559,genre:'thriller',
    marks:[{page:40,at:n-8*864e5},{page:142,at:n}],at:n}],
  words:[],quotes:[],notes:[]}))});
await p.reload(); await p.waitForTimeout(500);
await p.click('.facing'); await p.waitForTimeout(400);
await p.click('text=+ Add a word'); await p.fill('#w','susurrus');
await p.click('button:has-text("Look up")'); await p.waitForTimeout(2500);
let t=await p.textContent('#lk');
ok('finds the word with no network at all', t.includes('whisper'));
ok('names the built-in source', t.includes('LingoBox dictionary'));
await p.fill('#w','quivering'); await p.click('button:has-text("Look up")'); await p.waitForTimeout(900);
t=await p.textContent('#lk');
ok('handles inflections (quivering → quiver)', t.includes('quiver'));
await p.fill('#w','petrichor'); await p.click('button:has-text("Look up")'); await p.waitForTimeout(900);
ok('knows modern words too', (await p.textContent('#lk')).includes('rain falling on dry earth'));
await p.click('.sense >> nth=0'); await p.fill('#mine','wind through paper'); await p.click('#ok');
await p.waitForTimeout(400);
ok('saves from the built-in dictionary', await p.isVisible('text=wind through paper'));

console.log('\n── THE SHELF ──');
await p.click('[data-go=home]'); await p.waitForTimeout(600);
ok('shelf is titled with the owner', await p.isVisible('text=Kinnari’s shelf'));
ok('books stand on a ledge', await p.isVisible('.ledge'));
ok('current book stands face-out', await p.isVisible('.facing'));
ok('progress shown on the jacket', await p.isVisible('.facing .pct'));
ok('author shown beside the shelf', (await p.textContent('.nowread')).includes('Donna Tartt'));
ok('page position shown', (await p.textContent('.nowread')).includes('page 142'));
ok('reading pace estimated', /days left|a day left|finishing today/.test(await p.textContent('.nowread')));
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('lingobox.v1'));
  d.books.push({id:'b2',title:'Second Book',author:'Someone Else',page:5,pages:200,genre:'nature',at:Date.now()});
  localStorage.setItem('lingobox.v1',JSON.stringify(d))});
await p.reload(); await p.waitForTimeout(500);
ok('other books stand as spines', await p.isVisible('.spine'));
ok('spine carries its author', (await p.textContent('.spine .a'))==='Someone Else');

console.log('\n── VOCAB HYPE ──');
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('lingobox.v1'));const n=Date.now();
  const mk=(w,reps,int)=>({id:w,bookId:'b1',word:w,meaning:w+' means something',mine:'mine',page:1,at:n,
    srs:{ease:2.5,reps,interval:int,due:n+int*864e5}});
  d.words=[mk('alpha',6,30),mk('beta',5,25),mk('gamma',3,8),mk('delta',1,2),mk('epsilon',0,0),mk('zeta',0,0)];
  localStorage.setItem('lingobox.v1',JSON.stringify(d))});
await p.reload(); await p.waitForTimeout(500);
await p.click('.tab[data-go=words]'); await p.waitForTimeout(400);
ok('rank shown', await p.isVisible('text=Rank'));
ok('mastered count shown', (await p.textContent('.card')).includes('mastered'));
ok('level bar drawn', await p.isVisible('.lvbar i'));
ok('words carry level badges', await p.isVisible('.chip.lv.master'));
ok('tells you what is next', /more words? to reach/.test(await p.textContent('#app')));
const counts=await p.evaluate(()=>countLevels());
ok('levels counted right '+JSON.stringify(counts), counts.master===2&&counts.known===1&&counts.learn===1&&counts.new===2);
await p.click('.tab[data-go=practice]'); await p.click('.toc:has-text("Flashcards")'); await p.waitForTimeout(400);
for(let i=0;i<8;i++){
  if(!(await p.isVisible('.flash'))) break;
  await p.click('.flash'); await p.waitForTimeout(150);
  await p.click('button:has-text("Good")'); await p.waitForTimeout(200);
}
ok('score screen at the end', await p.isVisible('text=words practised'));
ok('score shows mastered + rank', (await p.textContent('#app')).includes('rank'));
await p.screenshot({path:'shelf-done.png'});
await p.click('[data-go=home]'); await p.waitForTimeout(600); await p.screenshot({path:'shelf-home.png'});
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
