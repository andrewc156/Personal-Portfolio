// Minimal GitHub-Pages-like static server. Usage: node ghp-server.mjs <rootDir> <port> <base e.g. /Personal-Portfolio/>
// - serves files; directories -> index.html; dir without trailing slash -> 301 to slash
// - unknown path under base -> <root><base>404.html with status 404; outside base -> plain 404
// - logs every request to stdout as "STATUS PATH"
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const [root, port = '4321', base = '/Personal-Portfolio/'] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.f32': 'application/octet-stream', '.pdf': 'application/pdf' };
async function file(p) { try { const s = await stat(p); return s; } catch { return null; } }
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);
  const fsPath = normalize(join(root, path));
  if (!fsPath.startsWith(normalize(root))) { res.writeHead(403); return res.end(); }
  let s = await file(fsPath);
  let target = fsPath;
  if (s?.isDirectory()) {
    if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' + url.search }); console.log('301', req.url); return res.end(); }
    target = join(fsPath, 'index.html'); s = await file(target);
  }
  if (s?.isFile()) {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Content-Length': body.length });
    console.log('200', req.url);
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const nf = path.startsWith(base) ? join(root, base, '404.html') : null;
  if (nf && (await file(nf))) { const body = await readFile(nf); res.writeHead(404, { 'Content-Type': types['.html'] }); console.log('404*', req.url); return res.end(body); }
  res.writeHead(404, { 'Content-Type': 'text/plain' }); console.log('404', req.url); res.end('Not Found');
}).listen(Number(port), () => console.log(`listening ${port} root=${root} base=${base}`));
