import { createServer, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Resolves a friendly, extensionless URL to its on-disk index.html without redirecting.
async function resolveFilePath(distDirectory: string, pathname: string): Promise<string | undefined> {
  const decodedPath = decodeURIComponent(pathname).replace(/\/+$/, '');
  const requestedPath = resolve(join(distDirectory, decodedPath));

  if (requestedPath !== distDirectory && !requestedPath.startsWith(distDirectory + sep)) {
    return undefined;
  }

  const candidates = extname(requestedPath)
    ? [requestedPath]
    : [join(requestedPath, 'index.html'), `${requestedPath}.html`];

  for (const candidate of candidates) {
    try {
      const candidateStat = await stat(candidate);
      if (candidateStat.isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

async function serve(): Promise<void> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDirectory, '..', '..');
  const distDirectory = join(projectRoot, 'dist');
  const port = Number(process.env.PORT) || 5173;
  const liveReloadEnabled = process.env.LIVE_RELOAD === '1';
  const reloadClients = new Set<ServerResponse>();

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (liveReloadEnabled && url.pathname === '/__live-reload') {
      if (request.method === 'GET') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        response.write('retry: 1000\n\n');
        reloadClients.add(response);
        response.on('close', () => reloadClients.delete(response));
        return;
      }

      if (request.method === 'POST') {
        for (const client of reloadClients) {
          client.write('event: reload\ndata: build-complete\n\n');
        }
        response.writeHead(204);
        response.end();
        return;
      }

      response.writeHead(405, { Allow: 'GET, POST' });
      response.end();
      return;
    }

    resolveFilePath(distDirectory, url.pathname)
      .then(async filePath => {
        if (!filePath) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('404 Not Found');
          return;
        }

        let body: Buffer | string = await readFile(filePath);
        if (liveReloadEnabled && extname(filePath) === '.html') {
          const reloadScript = '<script>const reloadEvents = new EventSource("/__live-reload"); reloadEvents.addEventListener("reload", () => window.location.reload());</script>';
          const html = body.toString('utf8');
          body = html.replace(/<\/body\s*>/i, `${reloadScript}</body>`);
          if (body === html) {
            body += reloadScript;
          }
        }

        response.writeHead(200, {
          'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
          ...(liveReloadEnabled ? { 'Cache-Control': 'no-store' } : {}),
        });
        response.end(body);
      })
      .catch(error => {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('500 Internal Server Error');
        console.error((error as Error).message);
      });
  });

  server.listen(port, () => {
    console.log(`Serving ${distDirectory} at http://localhost:${port}/`);
  });
}

serve().catch(error => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
