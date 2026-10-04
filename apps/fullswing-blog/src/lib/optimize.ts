import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { transform } from 'esbuild';
import { minify as minifyHtmlSource } from 'html-minifier-terser';

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.txt', '.xml']);
// Below this size the encoding overhead outweighs the savings.
const MIN_COMPRESS_BYTES = 256;

export async function minifyHtml(html: string): Promise<string> {
  return minifyHtmlSource(html, {
    collapseWhitespace: true,
    // Keeps a single space instead of removing it, so inline text and SVG labels are never joined.
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  });
}

export async function minifyCss(css: string): Promise<string> {
  return (await transform(css, { loader: 'css', minify: true })).code;
}

export async function minifyJs(js: string): Promise<string> {
  return (await transform(js, { loader: 'js', format: 'esm', minify: true })).code;
}

async function* walk(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}

/**
 * Minifies generated HTML and the site's own CSS/JS in `dist/assets`, then writes
 * `.br` and `.gz` siblings so a server can send pre-compressed responses.
 */
export async function optimizeDist(distDirectory: string): Promise<void> {
  const ownAssetsPrefix = join(distDirectory, 'assets') + '\\';
  const ownAssetsPrefixPosix = join(distDirectory, 'assets') + '/';

  for await (const filePath of walk(distDirectory)) {
    const extension = extname(filePath);
    if (!COMPRESSIBLE_EXTENSIONS.has(extension)) {
      continue;
    }

    const isOwnAsset = filePath.startsWith(ownAssetsPrefix) || filePath.startsWith(ownAssetsPrefixPosix);
    let content = await readFile(filePath, 'utf8');

    if (extension === '.html') {
      content = await minifyHtml(content);
    } else if (extension === '.css' && isOwnAsset) {
      content = await minifyCss(content);
    } else if (extension === '.js' && isOwnAsset) {
      content = await minifyJs(content);
    }
    await writeFile(filePath, content, 'utf8');

    const bytes = Buffer.from(content, 'utf8');
    if (bytes.length < MIN_COMPRESS_BYTES) {
      continue;
    }
    await Promise.all([
      brotli(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY } })
        .then(compressed => writeFile(`${filePath}.br`, compressed)),
      gzipAsync(bytes, { level: 9 }).then(compressed => writeFile(`${filePath}.gz`, compressed)),
    ]);
  }
}
