import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
const port = Number(process.env.PORT) || 5173;

if (!npmCli) {
  throw new Error('Run this script through npm so it can locate the npm CLI.');
}

const watchers = ['src', 'public'].map(directory =>
  watch(resolve(projectRoot, directory), { recursive: true }, () => scheduleBuild())
);
let buildTimer;
let building = false;
let rebuildRequested = false;

function runBuild() {
  return new Promise(resolveBuild => {
    const build = spawn(process.execPath, [npmCli, 'run', 'build'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    build.on('error', error => {
      console.error(`Unable to start build: ${error.message}`);
      resolveBuild(1);
    });
    build.on('exit', code => resolveBuild(code ?? 1));
  });
}

async function rebuild() {
  if (building) {
    rebuildRequested = true;
    return;
  }

  building = true;
  do {
    rebuildRequested = false;
    const exitCode = await runBuild();
    if (exitCode !== 0) {
      console.error(`Build failed with exit code ${exitCode}.`);
    } else {
      try {
        await fetch(`http://127.0.0.1:${port}/__live-reload`, { method: 'POST' });
      } catch (error) {
        console.error(`Unable to notify preview browsers: ${error.message}`);
      }
    }
  } while (rebuildRequested);
  building = false;
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => void rebuild(), 150);
}

const server = spawn(process.execPath, ['.build/src/serve.js'], {
  cwd: projectRoot,
  env: { ...process.env, LIVE_RELOAD: '1' },
  stdio: 'inherit',
});

function stop() {
  clearTimeout(buildTimer);
  watchers.forEach(watcher => watcher.close());
  server.kill();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('error', error => {
  console.error(`Unable to start preview server: ${error.message}`);
  stop();
  process.exitCode = 1;
});
server.on('exit', code => {
  watchers.forEach(watcher => watcher.close());
  process.exitCode = code ?? 1;
});

console.log('Watching src/ and public/ for changes.');