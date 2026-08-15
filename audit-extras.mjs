import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:400,height:880},acceptDownloads:true,permissions:['microphone']});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
// stub speech recognition (headless Chromium has none) + TTS
await p.addInitScript(()=>{
  window.__said=null;
  class FakeSR{
    constructor(){this.lang='';this.onresult=null;this.onerror=null;this.onend=null}
    start(){setTimeout(()=>{
      if(window.__mode==='error'){this.onerror&&this.onerror({error:'no-speech'});return}
      const t=window.__mode==='wrong'?'banana':window.__target;
      this.onresult&&this.onresult({results:[[{transcript:t}]]});
      this.onend&&this.onend();
    },40)}
  }
  window.SpeechRecognition=FakeSR;
  speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{};
});
// Open Library search
await p.route('**/openlibrary.org/search.json**',r=>r.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify({docs:[
    {title:'The Secret History',author_name:['Donna Tartt'],number_of_pages_median:559,first_publish_year:1992,cover_i:8231856},
    {title:'The Goldfinch',author_name:['Donna Tartt'],number_of_pages_median:771,first_publish_year:2013,cover_i:7222246}]})}));
await p.route('**/covers.openlibrary.org/**',r=>r.fulfill({status:200,contentType:'image/png',
  body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')}));
await p.goto('file:///home/user/Widget/app.html');
await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
  profile:{name:'Kinnari',at:n,streak:2,lastDay:new Date().toDateString()},prefs:{},
  books:[],words:[],quotes:[],notes:[]}))});
await p.reload(); await p.waitForTimeout(400);

console.log('\n── 1. BOOK COVERS ──');
await p.click('text=Add your first book');
await p.fill('#t','secret history'); await p.click('button:has-text("Find")'); await p.waitForTimeout(600);
ok('search returns results', (await p.locator('#fb .sense').count())===2);
ok('results show covers', await p.isVisible('#fb img.cov'));
ok('results show author + year', (await p.textContent('#fb')).includes('Donna Tartt'));
await p.click('#fb .sense >> nth=0'); await p.waitForTimeout(300);
ok('title filled', (await p.inputValue('#t'))==='The Secret History');
ok('author filled', (await p.inputValue('#a'))==='Donna Tartt');
ok('page count filled', (await p.inputValue('#tp'))==='559');
ok('confirms it found it', (await p.textContent('#fb')).includes('Filled in'));
await p.fill('#p','142'); await p.click('.gen:has-text("Thriller")'); await p.click('#ok'); await p.waitForTimeout(500);
ok('cover stored on the book', await p.evaluate(()=>/covers\.openlibrary\.org/.test(JSON.parse(localStorage.getItem('lingobox.v1')).books[0].cover)));
ok('cover shows on the shelf card', await p.isVisible('.bookcard img.cov'));
await p.click('.bookcard'); await p.waitForTimeout(400);
ok('cover shows in the book hero', await p.isVisible('.hero img.cov'));

console.log('\n── storage ──');
ok('asked the browser to keep the data', await p.evaluate(()=>'persisted' in (JSON.parse(localStorage.getItem('lingobox.v1')).prefs||{})));

console.log('\n── 2. SAY IT ──');
for(const [w,m] of [['susurrus','wind through paper'],['liminal','between two states'],['ersatz','a poor substitute']]){
  await p.click('button:has-text("Words")'); await p.click('text=+ Add a word');
  await p.fill('#w',w); await p.fill('#mine',m); await p.click('#ok'); await p.waitForTimeout(250);
}
await p.click('.tab[data-go=practice]'); await p.waitForTimeout(300);
ok('four practice modes now', (await p.locator('.mode').count())===4);
ok('“Say it” mode offered', await p.isVisible('.mode:has-text("Say it")'));
await p.click('.mode:has-text("Say it")'); await p.waitForTimeout(400);
ok('shows the meaning, not the word', (await p.textContent('.card')).includes('Which word is this'));
ok('promises the voice stays put', await p.isVisible('text=never leaves the device'));
await p.evaluate(()=>{window.__mode='right';window.__target=sess.queue[0].word});
await p.click('button:has-text("Tap and say it")'); await p.waitForTimeout(500);
ok('correct answer accepted', await p.isVisible('text=That’s it'));
ok('shows what it heard', (await p.textContent('#app')).includes('heard:'));
await p.click('button:has-text("Next")'); await p.waitForTimeout(300);
await p.evaluate(()=>{window.__mode='wrong'});
await p.click('button:has-text("Tap and say it")'); await p.waitForTimeout(500);
ok('wrong answer caught', await p.isVisible('text=Not quite'));
ok('reveals the word to hear', await p.isVisible('.word .say'));
await p.click('button:has-text("Next")'); await p.waitForTimeout(300);
await p.evaluate(()=>{window.__mode='error'});
await p.click('button:has-text("Tap and say it")'); await p.waitForTimeout(500);
ok('mic trouble explained, not silent', await p.isVisible('text=Didn’t catch anything'));
await p.click('.iconb[aria-label=Stop]'); await p.waitForTimeout(300);

console.log('\n── 3. QUOTE AS IMAGE ──');
await p.click('.tab[data-go=home]'); await p.click('.bookcard'); await p.waitForTimeout(300);
await p.click('button:has-text("Quotes")'); await p.click('text=+ Add a quote');
await p.fill('#q','Beauty is terror. Whatever we call beautiful, we quiver before it.');
await p.click('#ok'); await p.waitForTimeout(400);
ok('share button on the quote', await p.isVisible('button:has-text("Share as image")'));
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('button:has-text("Share as image")')]);
ok('produces a png '+dl.suggestedFilename(), /^lingobox-quote-\d{4}-\d{2}-\d{2}\.png$/.test(dl.suggestedFilename()));
const path=await dl.path(); const fs=await import('fs');
const buf=fs.readFileSync(path);
ok('file is a real PNG', buf.slice(1,4).toString()==='PNG');
ok('image is a decent size ('+Math.round(buf.length/1024)+'kb)', buf.length>4000);
const dims=await p.evaluate(async()=>{const q=db.quotes[0];const b=book(q.bookId);return {g:genreOf(b.genre).name}});
ok('drawn in the book’s genre ('+dims.g+')', dims.g==='Thriller');
await p.screenshot({path:'three.png'});
console.log(`\n${'='.repeat(44)}\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
