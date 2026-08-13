import {chromium} from 'playwright';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await br.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage(); let pass=0,fail=0;
const ok=(n,c)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}`)};
p.on('pageerror',e=>{fail++;console.log('FAIL  JS ERROR '+e.message)});
await p.goto('file:///home/user/Widget/index.html');
// record TTS + audio attempts
// speechSynthesis is a read-only accessor on window, so wrap its method
// rather than replacing the object.
await p.addInitScript(()=>{window.__spoke=[];window.__played=[];
  speechSynthesis.speak = u => { window.__spoke.push(u.text); };
  speechSynthesis.cancel = () => {};
  window.Audio=function(u){window.__played.push(u);
    return {play:()=>Promise.reject(new Error('blocked'))}};});
await p.reload();
await p.route('**/api.dictionaryapi.dev/**',r=>r.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify([{word:'love',phonetic:'/lʌv/',phonetics:[{text:'/lʌv/'},{text:'/lʌv/',audio:'https://example.com/love.mp3'}],
  meanings:[{partOfSpeech:'noun',definitions:[{definition:'A strong feeling of affection.'}],synonyms:['adoration']}]}])}));
await p.click('text=Add a book');await p.fill('#t','B');await p.click('#ok');await p.click('.row');
await p.click('text=Add a word');await p.fill('#w','love');
await p.click('button:has-text("Look up")');await p.waitForTimeout(600);
ok('speaker button in lookup panel', await p.isVisible('#lk .say'));
await p.click('#lk .say');await p.waitForTimeout(300);
ok('tries the real recording first', (await p.evaluate(()=>window.__played)).includes('https://example.com/love.mp3'));
ok('falls back to voice when audio fails', (await p.evaluate(()=>window.__spoke)).includes('love'));
await p.click('.sense >> nth=0');await p.fill('#mine','safe room');await p.click('#ok');await p.waitForTimeout(300);
ok('audio url stored on the word', await p.evaluate(()=>JSON.parse(localStorage.getItem('margin.v1')).words[0].audio==='https://example.com/love.mp3'));
ok('speaker on word in book', await p.isVisible('.entry .say'));
await p.click('.tab[data-go=dict]');
ok('speaker in dictionary', await p.isVisible('.entry .say'));
await p.click('.tab[data-go=review]');
ok('speaker on flashcard front', await p.isVisible('.flash .say'));
await p.evaluate(()=>{window.__spoke=[];window.__played=[]});
await p.click('.flash .say');await p.waitForTimeout(250);
ok('speaking does NOT flip the card', !(await p.isVisible('.rate')));
await p.click('.flash');await p.waitForTimeout(250);
ok('card still flips normally', await p.isVisible('.rate'));
// word with no audio -> straight to voice
await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('margin.v1'));d.words[0].audio='';localStorage.setItem('margin.v1',JSON.stringify(d))});
await p.reload();await p.waitForTimeout(300);
await p.click('.tab[data-go=dict]');await p.evaluate(()=>{window.__spoke=[];window.__played=[]});
await p.click('.entry .say');await p.waitForTimeout(250);
ok('no audio url → uses voice directly', (await p.evaluate(()=>window.__spoke)).includes('love') && (await p.evaluate(()=>window.__played)).length===0);
console.log(`\nPASSED ${pass}  FAILED ${fail}`);
await br.close();
