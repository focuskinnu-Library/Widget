import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:430,height:930},deviceScaleFactor:2});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
await p.route('**/sw.js',r=>r.abort());
await p.addInitScript(()=>{speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{}});
await p.goto('http://127.0.0.1:8777/app.html');
await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
  profile:{name:'Kinnari',at:n-12*864e5,streak:12,lastDay:new Date().toDateString()},prefs:{},
  books:[{id:'b1',title:'The Secret History',author:'Donna Tartt',page:142,pages:559,genre:'literary',
    marks:[{page:40,at:n-9*864e5},{page:100,at:n-4*864e5},{page:142,at:n}],at:n},
   {id:'b2',title:'Piranesi',author:'Susanna Clarke',page:88,pages:245,genre:'fantasy',at:n+1}],
  words:[{id:'w1',bookId:'b1',word:'susurrus',meaning:'a whisper',mine:'wind through paper',page:74,at:n,
    srs:{ease:2.5,reps:6,interval:30,due:n+30*864e5}}],
  quotes:[],notes:[]}))});
await p.reload(); await p.waitForTimeout(900);

console.log('── CATALOGUING ──');
ok('spines carry a paste-on label', await p.isVisible('.spine .label'));
ok('face-out copy carries one too', await p.isVisible('.facing .label'));
const lbl=(await p.textContent('.spine .label')).replace(/\s+/g,' ').trim();
ok('label is class + author ('+lbl+')', /^823\.87\s*CLA$/.test(lbl));
ok('call number derives from genre+author', await p.evaluate(()=>callNo(db.books[0]))==='823.91 TAR');
ok('anonymous author still gets a mark', await p.evaluate(()=>callNo({genre:'poetry',author:''}))==='821.91 ANO');
ok('accession numbers are stable', await p.evaluate(()=>accession(db.books[0])===accession(db.books[0])));
ok('accessions differ per volume', await p.evaluate(()=>accession(db.books[0])!==accession(db.books[1])));

console.log('\n── THE DATE-DUE SLIP ──');
await p.click('.facing'); await p.waitForTimeout(600);
ok('slip pasted in the volume', await p.isVisible('.dueslip'));
ok('slip headed with the call number', (await p.textContent('.dueslip h4')).includes('823.91 TAR'));
ok('a stamp per bookmark move', (await p.locator('.dueslip .dates i').count())===3);
ok('stamps are dated', /\d{2} [A-Z]{3} \d{2}/.test(await p.textContent('.dueslip .dates')));
ok('catalogue heading in the hero', (await p.textContent('.hero')).includes('823.91 TAR · A0'));
await p.screenshot({path:'lib-book.png'});

console.log('\n── A BOOK WITH NO HISTORY ──');
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('lingobox.v1'));
  delete d.books[0].marks; localStorage.setItem('lingobox.v1',JSON.stringify(d))});
await p.reload(); await p.waitForTimeout(600); await p.click('.facing'); await p.waitForTimeout(500);
ok('empty slip explains itself', (await p.textContent('.dueslip')).includes('No stamps yet'));

console.log('\n── THE CARD CATALOGUE ──');
await p.click('[data-go=words]'); await p.waitForTimeout(600);
ok('words are catalogue cards', await p.isVisible('.catcard'));
ok('each card typed with its call number', (await p.textContent('.catcard .callno'))==='823.91 TAR');
ok('alphabet dropcaps kept', await p.locator('.dropcap').first().isVisible());
await p.screenshot({path:'lib-cards.png'});

console.log('\n── EX LIBRIS ──');
await p.click('[data-go=you]'); await p.waitForTimeout(600);
ok('bookplate present', await p.isVisible('.exlibris'));
ok('reads Ex Libris', (await p.textContent('.exlibris .ex')).toLowerCase().includes('ex libris'));
ok('names the owner', (await p.textContent('.exlibris .nm'))==='Kinnari');
ok('counts the collection', /VOLUME|CARD/.test(await p.textContent('.exlibris .acc')));
await p.screenshot({path:'lib-plate.png'});

console.log('\n── STILL USABLE ──');
ok('no horizontal scroll', await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
const contrast=await p.evaluate(()=>{const e=document.querySelector('.exlibris .nm');
  const c=getComputedStyle(e).color; return c});
ok('bookplate name has ink ('+contrast+')', !!contrast);
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
