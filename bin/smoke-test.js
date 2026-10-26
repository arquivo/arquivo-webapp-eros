'use strict';

// Boot smoke test: start the app, wait until it serves "/", then stop it.
// Run with `npm run test:smoke`; CI runs the same script.

const { spawn } = require('node:child_process');
const path = require('node:path');

const url = 'http://localhost:3000/'; // server.js always listens on 3000
const attempts = 20;

function fail(message) {
  // GitHub Actions turns "::error::" lines into annotations
  console.error(process.env.GITHUB_ACTIONS ? `::error::${message}` : message);
  process.exitCode = 1;
}

async function serves() {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  // A server already on :3000 (e.g. `npm start`) would answer instead of the one we boot
  if (await serves()) {
    fail(`Something is already serving ${url} — stop it before running the smoke test`);
    return;
  }

  const app = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { stdio: 'inherit' });
  let exited = false;
  app.on('exit', () => { exited = true; });

  for (let i = 1; i <= attempts && !exited; i++) {
    if (await serves()) {
      console.log(`App responded on / (attempt ${i})`);
      app.kill();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  app.kill();
  fail(`App failed to serve / on :3000 — boot smoke test failed${exited ? ' (process exited early)' : ''}`);
}

main();
