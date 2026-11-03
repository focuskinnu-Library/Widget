/* One place that knows where Chromium is.
   The sandbox these suites were written in ships a browser at a fixed path and
   no downloaded one; CI downloads its own and has nothing at that path. Asking
   the filesystem is more honest than branching on an environment name.
   CHROMIUM_PATH overrides both. */
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';

const PINNED = '/opt/pw-browsers/chromium';
const at = process.env.CHROMIUM_PATH || (existsSync(PINNED) ? PINNED : '');

export const launch = (opts = {}) =>
  chromium.launch(at ? {...opts, executablePath: at} : opts);
