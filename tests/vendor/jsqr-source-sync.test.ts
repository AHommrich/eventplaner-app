/**
 * Guards the vendored jsQR copy against silent drift.
 *
 * `lib/vendor/jsQRSource.ts` embeds the jsQR JavaScript source as a
 * template literal so `lib/QrFromImage.tsx` can inline it into the WebView
 * that decodes gallery-picked QR images. If someone bumps the `jsqr`
 * dependency in `package.json` but forgets to run
 * `node scripts/vendor-jsqr.mjs`, the app would ship an outdated decoder
 * and — depending on the diff — could regress bug fixes or introduce
 * incompatibilities.
 *
 * This test asserts three things:
 *   1. The vendored version string matches the installed `jsqr` version.
 *   2. The embedded template-literal content is byte-for-byte identical to
 *      `node_modules/jsqr/dist/jsQR.js`.
 *   3. The vendored source still contains no backticks or `${…}` — the
 *      same invariant `scripts/vendor-jsqr.mjs` enforces at generation
 *      time, re-checked here so a hand edit cannot break the embed.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// The generator writes the file with this exact prologue/epilogue. Extract
// the raw source between them to compare against the npm copy.
const PROLOGUE_MARKER = 'export const JSQR_SOURCE = `';
const EPILOGUE_MARKER = '`;\n\n/** Semver of the vendored jsQR copy';

function readVendoredSource(): { rawSource: string; version: string } {
  const vendoredPath = path.join(REPO_ROOT, 'lib/vendor/jsQRSource.ts');
  const contents = fs.readFileSync(vendoredPath, 'utf-8');

  const startIdx = contents.indexOf(PROLOGUE_MARKER);
  const endIdx = contents.indexOf(EPILOGUE_MARKER);
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    throw new Error(
      'lib/vendor/jsQRSource.ts is missing the expected prologue/epilogue ' +
        'markers. Regenerate with `node scripts/vendor-jsqr.mjs`.'
    );
  }
  const rawSource = contents.slice(startIdx + PROLOGUE_MARKER.length, endIdx);

  const versionMatch = contents.match(/JSQR_VERSION = "([^"]+)"/);
  if (!versionMatch) throw new Error('JSQR_VERSION export is missing.');

  return { rawSource, version: versionMatch[1] };
}

describe('vendor/jsqr-source-sync', () => {
  it('vendored version string matches the installed jsqr version', () => {
    const { version } = readVendoredSource();
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'node_modules/jsqr/package.json'), 'utf-8')
    );
    expect(version).toBe(pkg.version);
  });

  it('embedded source is byte-identical to node_modules/jsqr/dist/jsQR.js', () => {
    const { rawSource } = readVendoredSource();
    const upstream = fs.readFileSync(
      path.join(REPO_ROOT, 'node_modules/jsqr/dist/jsQR.js'),
      'utf-8'
    );
    expect(rawSource.length).toBe(upstream.length);
    expect(rawSource).toBe(upstream);
  });

  it('embedded source contains no backticks or template-interpolation markers', () => {
    // If a future jsQR release introduces `` or ${, the naive embed strategy
    // would break silently. The generator refuses to write in that case, but
    // we re-check here to catch a hand edit that bypassed the generator.
    const { rawSource } = readVendoredSource();
    expect(rawSource).not.toMatch(/`/);
    expect(rawSource).not.toMatch(/\$\{/);
  });
});
