// Internal link check (spec §11 step 4). linkinator's local-directory mode
// scans 0 links in v8.1, so serve dist/ with `astro preview` on 4321 and crawl it.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { preview } from 'astro';

const PORT = 4321;
const base = `http://localhost:${PORT}/`;

try {
  const server = await preview({
    server: { port: PORT },
    vite: { preview: { strictPort: true } },
  });
  try {
    const linkinator = spawn(
      'npx',
      ['linkinator', base, '--config', 'linkinator.config.json', ...process.argv.slice(2)],
      { stdio: 'inherit' },
    );
    const [code] = await once(linkinator, 'close');
    process.exitCode = code ?? 1;
  } finally {
    await server.stop();
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
