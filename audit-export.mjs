// Backup, export and restore — now reached from the You tab.
import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:400,height:880},acceptDownloads:true});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
const SEED=()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
  profile:{name:'Kinnari',at:n,streak:3,lastDay:new Date().toDateString()},prefs:{},
  books:[{id:'b1',title:'The Secret History',author:'Donna Tartt',page:142,pages:559,genre:'thriller',at:n}],
  words:[{id:'w1',bookId:'b1',word:'susurrus',phonetic:'/lʌv/',meaning:'noun — a soft whispering sound',
    mine:'Like wind through "paper"',context:'A susurrus of leaves.',page:74,at:n,srs:{ease:2.5,reps:0,interval:0,due:n}}],
  quotes:[{id:'q1',bookId:'b1',text:'Beauty is terror.',page:52,at:n}],
  notes:[{id:'n1',bookId:'b1',text:'Hallway in green.',page:140,at:n}]}))};
await p.goto('file:///home/user/Widget/app.html');
await p.evaluate(SEED); await p.reload(); await p.waitForTimeout(400);
await p.click('.tab[data-go=you]'); await p.waitForTimeout(300);
ok('backup lives in You', await p.isVisible('text=Download a backup'));
ok('counts everything saved (4)', (await p.textContent('#app')).includes('4 things saved'));

async function grab(sel){const [d]=await Promise.all([p.waitForEvent('download'),p.click(sel)]);
  const s=await d.createReadStream(); let t=''; for await(const c of s) t+=c;
  return {name:d.suggestedFilename(),body:t};}

const j=await grab('text=Download a backup');
ok('backup filename '+j.name, /^lingobox-backup-\d{4}-\d{2}-\d{2}\.json$/.test(j.name));
const parsed=JSON.parse(j.body);
ok('backup holds every record', parsed.books.length===1&&parsed.words.length===1&&parsed.quotes.length===1&&parsed.notes.length===1);
ok('backup keeps review scheduling', !!parsed.words[0].srs);
ok('backup keeps the profile', parsed.profile?.name==='Kinnari');

const m=await grab('text=Markdown');
ok('markdown filename '+m.name, /^lingobox-\d{4}-\d{2}-\d{2}\.md$/.test(m.name));
ok('md has book + genre', m.body.includes('## The Secret History')&&m.body.includes('Thriller'));
ok('md has both meanings', m.body.includes('**susurrus**')&&m.body.includes('In my words:'));
ok('md has quote and journal', m.body.includes('> Beauty is terror.')&&m.body.includes('Hallway in green.'));

const a=await grab('text=Anki deck');
ok('anki filename '+a.name, /^lingobox-anki-\d{4}-\d{2}-\d{2}\.txt$/.test(a.name));
ok('anki is two quoted columns', /^"susurrus","/.test(a.body));
ok('anki escapes inner quotes', a.body.includes('""paper""'));
ok('anki back carries book + page', a.body.includes('The Secret History · p.74'));

const fs=await import('fs'); fs.writeFileSync('/tmp/bk.json',j.body);
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('lingobox.v1'));
  d.books=[];d.words=[];d.quotes=[];d.notes=[];localStorage.setItem('lingobox.v1',JSON.stringify(d))});
await p.reload(); await p.waitForTimeout(400);
ok('shelf now empty', await p.isVisible('text=Your shelf is waiting'));
await p.click('.tab[data-go=you]'); await p.setInputFiles('#imp','/tmp/bk.json'); await p.waitForTimeout(700);
const back=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')));
ok('restore brings everything back', back.books.length===1&&back.words.length===1&&back.quotes.length===1&&back.notes.length===1);
await p.click('.tab[data-go=you]'); await p.setInputFiles('#imp','/tmp/bk.json'); await p.waitForTimeout(700);
ok('re-importing does not duplicate', await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')).words.length===1));
fs.writeFileSync('/tmp/junk.json','not json at all');
await p.click('.tab[data-go=you]'); await p.setInputFiles('#imp','/tmp/junk.json'); await p.waitForTimeout(600);
ok('junk file refused, data intact', await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')).books.length===1));
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
