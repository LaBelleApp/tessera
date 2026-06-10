// serve.mjs — zero-dependency static server for local preview of docs/.
//   npm run serve   →   http://localhost:4173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'docs');
const PORT = process.env.PORT || 4173;
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIR, p);
  if (!file.startsWith(DIR) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Tessera preview → http://localhost:${PORT}`));
