// Internal link check (spec §11 step 4). linkinator's local-directory mode
// scans 0 links in v8.1, so serve dist/ with `astro preview` on 4321 and crawl it.
import { spawn } from 'node:child_process';

const PORT = 4321;
const base = `http://localhost:${PORT}/`;
const server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--ignore-lock'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`preview server did not start on ${base}`);
}

let code = 1;
try {
  await waitForServer();
  code = await new Promise((resolve) => {
    const lk = spawn(
      'npx',
      ['linkinator', base, '--config', 'linkinator.config.json', ...process.argv.slice(2)],
      { stdio: 'inherit' },
    );
    lk.on('exit', (c) => resolve(c ?? 1));
  });
} catch (err) {
  console.error(err);
} finally {
  server.kill('SIGTERM');
}
process.exit(code);
