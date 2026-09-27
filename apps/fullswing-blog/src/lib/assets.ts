import { cp, lstat, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

const EXCLUDED_PUBLIC_EXTENSIONS = new Set(['.html', '.json', '.md']);

export async function copyProjectAssets(publicDirectory: string, sourceAssetsDirectory: string, distDirectory: string): Promise<void> {
  await copyPublicAssets(publicDirectory, distDirectory);
  await copyGeneratedAssets(sourceAssetsDirectory, join(distDirectory, 'assets'));
}

async function copyPublicAssets(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDirectory, entry.name);
    const destinationPath = join(destinationDirectory, entry.name);
    const entryStat = await lstat(sourcePath);

    if (entryStat.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyPublicAssets(sourcePath, destinationPath);
      continue;
    }

    if (EXCLUDED_PUBLIC_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath, { force: true });
  }
}

async function copyGeneratedAssets(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDirectory, entry.name);
    const destinationPath = join(destinationDirectory, entry.name);
    const entryStat = await lstat(sourcePath);

    if (entryStat.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyGeneratedAssets(sourcePath, destinationPath);
      continue;
    }

    const fileStat = await stat(sourcePath);
    if (!fileStat.isFile()) {
      continue;
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath, { force: true });
  }
}
