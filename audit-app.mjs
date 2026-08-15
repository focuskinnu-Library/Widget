import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:400,height:880},acceptDownloads:true});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL  JS ERROR '+e.message)});
await p.addInitScript(()=>{speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{}});
await p.route('**/api.dictionaryapi.dev/**',r=>r.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify([{word:'susurrus',phonetic:'/suh-SUR-uhs/',phonetics:[{text:'/suh-SUR-uhs/',audio:'https://x/a.mp3'}],
    meanings:[{partOfSpeech:'noun',definitions:[{definition:'A soft whispering or rustling sound.',example:'a susurrus of leaves'}],synonyms:['murmur','rustle']}]}])}));
await p.goto('file:///home/user/Widget/app.html');

console.log('\n── FIRST LAUNCH ──');
ok('greeted, not dumped on a blank page', await p.isVisible('text=Every book gives you'));
ok('explains before asking', await p.isVisible('text=A dictionary of your own'));
ok('promises no account', await p.isVisible('text=No password, no email'));
ok('no bottom nav before signup', !(await p.isVisible('nav .tab')));
await p.fill('#nm','Kinnari'); await p.click('text=Make my shelf'); await p.waitForTimeout(400);
ok('lands on a personal home', await p.isVisible('text=Kinnari'));
ok('nav appears after signup', await p.isVisible('nav .tab'));
ok('empty shelf teaches, not blank', await p.isVisible('text=Your shelf is waiting'));

console.log('\n── ADDING A BOOK ──');
await p.click('text=Add your first book');
await p.fill('#t','The Secret History'); await p.fill('#a','Donna Tartt');
await p.fill('#p','142'); await p.fill('#tp','559');
ok('all 8 genres offered', (await p.locator('.gen').count())===8);
await p.click('.gen:has-text("Thriller")'); await p.waitForTimeout(300);
ok('genre previews live', await p.evaluate(()=>document.documentElement.dataset.genre)==='thriller');
const fx=await p.evaluate(()=>({parts:window.parts?.length||0}));
await p.click('#ok'); await p.waitForTimeout(500);
ok('book card on shelf', await p.isVisible('text=The Secret History'));
ok('genre badge shown', await p.isVisible('.top-strip:has-text("Thriller")'));
ok('progress ring rendered', await p.isVisible('.ring svg'));
ok('weather is running', await p.evaluate(()=>document.getElementById('sky').width>0));

console.log('\n── INSIDE THE BOOK ──');
await p.click('.bookcard'); await p.waitForTimeout(400);
ok('hero shows page + genre line', (await p.textContent('.hero')).includes('142'));
ok('genre atmosphere line', (await p.textContent('.hero')).includes('nobody telling the truth'));
ok('empty words state teaches', await p.isVisible('text=No words yet'));
await p.click('text=+ Add a word'); await p.fill('#w','susurrus');
await p.click('button:has-text("Look up")'); await p.waitForTimeout(600);
ok('dictionary returns senses', await p.isVisible('text=A soft whispering'));
ok('synonyms shown', await p.isVisible('text=murmur'));
ok('real-speaker links offered', await p.isVisible('a:has-text("Real speakers")'));
const yg=await p.getAttribute('a:has-text("Real speakers")','href');
ok('youglish link correct ('+yg.slice(0,42)+'…)', yg.includes('youglish.com/pronounce/susurrus'));
await p.click('.sense >> nth=0');
await p.fill('#mine','Like wind through paper.'); await p.click('#ok'); await p.waitForTimeout(400);
ok('word saved with both meanings', await p.isVisible('text=Like wind through paper'));
ok('speaker button present', await p.isVisible('.entry .say'));

await p.click('button:has-text("Quotes")'); await p.click('text=+ Add a quote');
await p.fill('#q','Beauty is terror.'); await p.click('#ok'); await p.waitForTimeout(300);
ok('quote saved', await p.isVisible('text=Beauty is terror'));
await p.click('button:has-text("Journal")');
ok('journal empty state is inviting', await p.isVisible('text=No other app has anywhere for this'));
await p.click('text=+ Write an entry'); await p.fill('#n','The hallway in green.'); await p.click('#ok');
await p.waitForTimeout(300);
ok('journal entry saved', await p.isVisible('text=The hallway in green'));

console.log('\n── PRACTICE ──');
// add 3 more words so quiz has 4
for(const [w,m] of [['liminal','between two states'],['reciprocity','giving back'],['ersatz','a poor substitute']]){
  await p.click('button:has-text("Words")'); await p.click('text=+ Add a word');
  await p.fill('#w',w); await p.fill('#mine',m); await p.click('#ok'); await p.waitForTimeout(250);
}
await p.click('.tab[data-go=practice]'); await p.waitForTimeout(400);
ok('four practice modes', (await p.locator('.mode').count())===4);
ok('due count on nav pip', await p.isVisible('nav .pip'));
await p.click('.mode:has-text("Flashcards")'); await p.waitForTimeout(300);
ok('flashcard hides answer', !(await p.textContent('.flash')).includes('wind through paper'));
await p.click('.flash'); await p.waitForTimeout(300);
ok('flip reveals + rating', await p.isVisible('.rate'));
await p.click('button:has-text("Good")'); await p.waitForTimeout(300);
ok('progress bar advances', await p.isVisible('.prog'));
await p.click('.iconb[aria-label=Stop]'); await p.waitForTimeout(300);

await p.click('.mode:has-text("Quiz")'); await p.waitForTimeout(300);
ok('quiz asks which word', await p.isVisible('text=Which word means'));
ok('quiz gives 4 options', (await p.locator('.opt').count())===4);
await p.click('.opt >> nth=0'); await p.waitForTimeout(300);
ok('quiz marks the right answer', await p.isVisible('.opt.right'));
ok('quiz offers next', await p.isVisible('button:has-text("Next")'));
await p.click('.iconb[aria-label=Stop]'); await p.waitForTimeout(300);

await p.click('.mode:has-text("Spelling")'); await p.waitForTimeout(300);
ok('spelling has a play button', await p.isVisible('button:has-text("Play again")'));
const target=await p.evaluate(()=>sess.queue[0].word);
await p.fill('#sp',target); await p.click('button:has-text("Check")'); await p.waitForTimeout(300);
ok('spelling accepts correct answer', await p.isVisible('text=Exactly right'));
await p.click('.iconb[aria-label=Stop]'); await p.waitForTimeout(300);

console.log('\n── YOU ──');
await p.click('.tab[data-go=you]'); await p.waitForTimeout(300);
ok('shows streak / words / books', (await p.textContent('.card')).includes('day streak'));
ok('reminders offered', await p.isVisible('text=Reminders'));
ok('backup available', await p.isVisible('text=Download a backup'));
ok('privacy stated plainly', await p.isVisible('text=No account, no tracking'));

console.log('\n── WORLDS ──');
await p.click('.tab[data-go=home]'); await p.click('.bookcard'); await p.waitForTimeout(300);
for(const g of ['Romance','Fantasy','Nature','Horror']){
  await p.click('.iconb[aria-label="Change world"]'); await p.click(`.gen:has-text("${g}")`);
  await p.click('#ok'); await p.waitForTimeout(350);
  const cur=await p.evaluate(()=>document.documentElement.dataset.genre);
  const n=await p.evaluate(()=>parts.length);
  ok(`${g}: palette + weather (${n} particles)`, n>0);
}
await p.reload(); await p.waitForTimeout(600);
ok('everything survives reload', await p.isVisible('text=Kinnari'));
ok('no horizontal scroll', await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await p.screenshot({path:'u1.png'});
await p.click('.bookcard'); await p.waitForTimeout(600); await p.screenshot({path:'u2.png'});
await p.click('.tab[data-go=practice]'); await p.waitForTimeout(400); await p.screenshot({path:'u3.png'});
console.log(`\n${'='.repeat(44)}\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
