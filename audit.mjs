/* Runs every suite, totals the checks, exits non-zero if any failed.
   Two of the suites need the app served over HTTP — `fetch` cannot read a
   sibling file under file:// — so this starts a static server for them and
   shuts it down afterwards. That used to be a step you had to remember.

     node audit.mjs            all of it
     node audit.mjs shelf      just the suites whose names match
*/
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {readdirSync} from 'node:fs';
import {extname, join} from 'node:path';
import {spawn} from 'node:child_process';

const HERE = new URL('.', import.meta.url).pathname;
const PORT = Number(process.env.LINGOBOX_PORT || 8777);
const TYPES = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

const server = createServer(async (req, res) => {
  // No traversal: the suites only ever ask for files in this folder.
  const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  if (name.includes('..')) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(join(HERE, name));
    res.writeHead(200, {'content-type': TYPES[extname(name)] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
// If something is already on 8777 (a stray `python3 -m http.server`, a second
// run) take any free port instead of dying — the suites are told the URL.
const port = await new Promise((resolve, reject) => {
  server.once('error', e => {
    if (e.code !== 'EADDRINUSE') return reject(e);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
  server.listen(PORT, '127.0.0.1', () => resolve(PORT));
});
if (port !== PORT) console.log(`(port ${PORT} was busy — serving on ${port})\n`);

const want = process.argv.slice(2);
const suites = readdirSync(HERE)
  .filter(f => /^audit-.+\.mjs$/.test(f) && f !== 'audit-browser.mjs').sort()
  .filter(f => !want.length || want.some(w => f.includes(w)));

const run = f => new Promise(done => {
  const out = [];
  const kid = spawn(process.execPath, [join(HERE, f)],
    {env: {...process.env, LINGOBOX_URL: `http://127.0.0.1:${port}`}});
  kid.stdout.on('data', d => out.push(d));
  kid.stderr.on('data', d => out.push(d));
  kid.on('close', code => done({code, text: Buffer.concat(out).toString()}));
});

let checks = 0, failed = 0, broken = [];
for (const f of suites) {
  const {code, text} = await run(f);
  const tally = text.match(/PASSED (\d+)\s+FAILED (\d+)/);
  if (tally) {
    checks += +tally[1]; failed += +tally[2];
    const bad = +tally[2] > 0 || code !== 0;
    if (bad) broken.push(f);
    console.log(`${bad ? '✗' : '✓'} ${f.padEnd(22)} ${tally[1]} passed${+tally[2] ? `, ${tally[2]} FAILED` : ''}`);
    if (bad) console.log(text.split('\n').filter(l => l.startsWith('FAIL')).map(l => '    ' + l).join('\n'));
  } else {
    broken.push(f);
    console.log(`✗ ${f.padEnd(22)} crashed before it could report`);
    console.log(text.split('\n').slice(-12).map(l => '    ' + l).join('\n'));
  }
}

server.close();
console.log(`\n${checks} checks across ${suites.length} suites · ${failed ? failed + ' failed' : 'all green'}`);
if (broken.length) { console.log('broken: ' + broken.join(', ')); process.exit(1); }
