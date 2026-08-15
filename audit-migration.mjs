// The rename from Margin: old data must survive.
import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await br.newPage({viewport:{width:400,height:880}});
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
await p.goto('file:///home/user/Widget/app.html');
await p.evaluate(()=>{localStorage.clear();const n=Date.now();
  localStorage.setItem('margin.v1',JSON.stringify({
    profile:{name:'Kinnari',at:n,streak:4,lastDay:new Date().toDateString()},
    prefs:{theme:'dark'},
    books:[{id:'b1',title:'The Secret History',author:'Donna Tartt',page:142,pages:559,vibe:'dusk',at:n}],
    words:[{id:'w1',bookId:'b1',word:'susurrus',meaning:'a soft whispering',mine:'wind through paper',
      page:74,at:n,srs:{ease:2.5,reps:0,interval:0,due:n}}],
    quotes:[{id:'q1',bookId:'b1',text:'Beauty is terror.',page:52,at:n}],
    notes:[{id:'n1',bookId:'b1',text:'Green hallway.',page:140,at:n}]}))});
await p.reload(); await p.waitForTimeout(500);
ok('old Margin data still loads', await p.isVisible('text=The Secret History'));
ok('profile carried over', await p.isVisible('text=Kinnari'));
ok('theme preference carried over', await p.evaluate(()=>document.documentElement.dataset.theme)==='dark');
await p.click('.bookcard'); await p.waitForTimeout(400);
ok('words survived', await p.isVisible('text=wind through paper'));
ok('a book with no genre still renders', await p.evaluate(()=>!!document.documentElement.dataset.genre));
await p.click('text=Move bookmark'); await p.fill('#p','200'); await p.click('#ok'); await p.waitForTimeout(400);
const nw=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')||'null'));
ok('writes now go to lingobox.v1', !!nw&&nw.books[0].page===200);
ok('old key kept as a safety net', await p.evaluate(()=>!!localStorage.getItem('margin.v1')));
await p.reload(); await p.waitForTimeout(400);
await p.click('.bookcard'); await p.waitForTimeout(300);
ok('new key wins after migration', (await p.textContent('.hero')).includes('200'));
ok('quotes and journal came across too', await p.evaluate(()=>{
  const d=JSON.parse(localStorage.getItem('lingobox.v1'));return d.quotes.length===1&&d.notes.length===1}));
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
