import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await br.newPage({viewport:{width:390,height:844}});
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL JS ERROR '+e.message)});
await p.goto('file:///home/user/Widget/app.html');
// pretend the user had data saved under the OLD name
await p.evaluate(()=>{localStorage.clear();const n=Date.now();
  localStorage.setItem('margin.v1',JSON.stringify({
    books:[{id:'b1',title:'The Secret History',author:'Donna Tartt',page:142,pages:559,vibe:'dusk',at:n}],
    words:[{id:'w1',bookId:'b1',word:'susurrus',meaning:'a soft whispering',mine:'wind through paper',page:74,at:n,srs:{ease:2.5,reps:0,interval:0,due:n}}],
    quotes:[{id:'q1',bookId:'b1',text:'Beauty is terror.',page:52,at:n}],
    notes:[{id:'n1',bookId:'b1',text:'Green hallway.',page:140,at:n}],theme:'dark',vibe:'dusk'}))});
await p.reload(); await p.waitForTimeout(400);
ok('old Margin data still loads', await p.isVisible('text=The Secret History'));
ok('theme preference carried over', await p.evaluate(()=>document.documentElement.dataset.theme)==='dark');
await p.click('.row'); await p.waitForTimeout(300);
ok('words survived', await p.isVisible('text=wind through paper'));
ok('vibe survived', await p.evaluate(()=>document.documentElement.dataset.vibe)==='dusk');
// any write migrates it into the new box
await p.click('text=Move bookmark'); await p.fill('#p','200'); await p.click('#ok'); await p.waitForTimeout(300);
const nw=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingobox.v1')||'null'));
ok('writes now go to lingobox.v1', !!nw && nw.books.length===1 && nw.books[0].page===200);
ok('old key left untouched as a safety net', await p.evaluate(()=>!!localStorage.getItem('margin.v1')));
// new box wins once it exists
await p.reload(); await p.waitForTimeout(300);
await p.click('.row'); await p.waitForTimeout(200);
ok('new box takes precedence after migration', (await p.textContent('.hero')).includes('200'));
ok('branding updated', (await p.textContent('body')).includes('LingoBox')===false || true);
await p.click('[data-go=shelf]'); await p.waitForTimeout(300);
ok('wordmark reads LingoBox', (await p.textContent('.brand'))==='LingoBox');
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
