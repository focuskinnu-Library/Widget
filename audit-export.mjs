import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
await p.goto('file:///home/user/Widget/app.html');
// seed
await p.evaluate(()=>{const n=Date.now();localStorage.setItem('lingobox.v1',JSON.stringify({
 books:[{id:'b1',title:'The Secret History',author:'Donna Tartt',page:142,pages:559,vibe:'dusk',at:n}],
 words:[{id:'w1',bookId:'b1',word:'susurrus',phonetic:'/lʌv/',meaning:'noun — a soft whispering sound',
   mine:'Like wind through "paper"',context:'A susurrus of leaves.',page:74,at:n,srs:{ease:2.5,reps:0,interval:0,due:n}}],
 quotes:[{id:'q1',bookId:'b1',text:'Beauty is terror.',page:52,at:n}],
 notes:[{id:'n1',bookId:'b1',text:'Hallway in green.',page:140,at:n}],theme:null,vibe:'dusk'}))});
await p.reload();
ok('backup entry point on shelf', await p.isVisible('text=Backup & export'));
await p.click('text=Backup & export');
ok('sheet counts everything (4)', (await p.textContent('.sheet')).includes('4 things saved'));

async function grab(sel){
  const [d]=await Promise.all([p.waitForEvent('download'),p.click(sel)]);
  const s=await d.createReadStream(); let t='';
  for await (const c of s) t+=c;
  return {name:d.suggestedFilename(), body:t};
}
const j=await grab('text=Download a backup');
ok('backup filename '+j.name, /^lingobox-backup-\d{4}-\d{2}-\d{2}\.json$/.test(j.name));
const parsed=JSON.parse(j.body);
ok('backup is valid JSON with all records',
  parsed.books.length===1&&parsed.words.length===1&&parsed.quotes.length===1&&parsed.notes.length===1);
ok('backup keeps srs scheduling', !!parsed.words[0].srs);

const m=await grab('text=Markdown');
ok('markdown filename '+m.name, /^lingobox-\d{4}-\d{2}-\d{2}\.md$/.test(m.name));
ok('md has book heading', m.body.includes('## The Secret History'));
ok('md has word + both meanings', m.body.includes('**susurrus**')&&m.body.includes('a soft whispering')&&m.body.includes('In my words:'));
ok('md has quote', m.body.includes('> Beauty is terror.'));
ok('md has journal', m.body.includes('Hallway in green.'));

const a=await grab('text=Anki deck');
ok('anki filename '+a.name, /^lingobox-anki-\d{4}-\d{2}-\d{2}\.txt$/.test(a.name));
ok('anki is 2 quoted columns', /^"susurrus","/.test(a.body));
ok('anki escapes inner quotes', a.body.includes('""paper""'));
ok('anki back carries book + page', a.body.includes('The Secret History · p.74'));

// import
await p.click('text=Done');
await p.evaluate(()=>localStorage.setItem('lingobox.v1',JSON.stringify({books:[],words:[],quotes:[],notes:[]})));
await p.reload();
ok('shelf now empty', await p.isVisible('text=Your shelf is empty'));
await p.click('text=Backup & export');
const fs=await import('fs'); fs.writeFileSync('/tmp/bk.json', j.body);
await p.setInputFiles('#imp','/tmp/bk.json'); await p.waitForTimeout(600);
ok('restore brings books back', await p.isVisible('text=The Secret History'));
const back=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')));
ok('restore brings words/quotes/notes', back.words.length===1&&back.quotes.length===1&&back.notes.length===1);
// idempotent
await p.click('text=Backup & export');
await p.setInputFiles('#imp','/tmp/bk.json'); await p.waitForTimeout(600);
const again=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')).words.length);
ok('re-importing does not duplicate', again===1);
// junk file
fs.writeFileSync('/tmp/junk.json','not json at all');
await p.click('text=Backup & export');
await p.setInputFiles('#imp','/tmp/junk.json'); await p.waitForTimeout(500);
ok('junk file rejected, data intact', await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')).books.length===1));
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
