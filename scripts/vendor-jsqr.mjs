#!/usr/bin/env node
/**
 * Regenerates `lib/vendor/jsQRSource.ts` from `node_modules/jsqr/dist/jsQR.js`.
 *
 * Why we vendor a copy instead of `require`-ing jsqr directly:
 *   - The QR-from-image decoder in `lib/QrFromImage.tsx` runs the library
 *     inside a `WebView` (jsQR needs a real DOM `<canvas>`), so we need the
 *     library source as a *string* to inline into the HTML we hand the
 *     WebView. Metro's default loader has no way to hand us a `.js` file as
 *     a raw string — pulling in a raw-loader Babel plugin for one dependency
 *     is more moving parts than a committed snapshot.
 *   - The previous version loaded jsQR from `cdn.jsdelivr.net`, which was
 *     the *only* runtime third-party network call in the app. Vendoring the
 *     script kills that call and matches the DSGVO posture claimed in
 *     `docs/dependencies.md` (zero CDN traffic at runtime).
 *
 * Run this script whenever the `jsqr` version in `package.json` changes.
 * The companion test `tests/vendor/jsqr-source-sync.test.ts` fails in CI if
 * the committed snapshot drifts from the installed npm copy.
 *
 * jsQR itself is Apache-2.0 licensed. The attribution notice is preserved
 * at the top of the generated file (`lib/vendor/jsQRSource.ts`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const SOURCE_PATH = resolve(REPO_ROOT, 'node_modules/jsqr/dist/jsQR.js');
const TARGET_PATH = resolve(REPO_ROOT, 'lib/vendor/jsQRSource.ts');
const PKG_PATH = resolve(REPO_ROOT, 'node_modules/jsqr/package.json');

const source = readFileSync(SOURCE_PATH, 'utf-8');
const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));

// Sanity: jsQR must not itself use template-literal syntax anywhere, or the
// wrapping backtick literal below would break.
if (source.includes('`') || source.includes('${')) {
  console.error(
    'ERROR: jsQR source contains backticks or ${...}. It cannot be embedded ' +
      'as a bare template literal. Vendor strategy must be revised.'
  );
  process.exit(1);
}

const header = `/**
 * VENDORED jsQR source — do NOT edit by hand.
 *
 * Regenerate with:  node scripts/vendor-jsqr.mjs
 *
 * Upstream:   https://github.com/cozmo/jsQR (v${pkg.version})
 * License:    Apache-2.0 (see node_modules/jsqr/LICENSE)
 * Purpose:    Loaded as a string into the invisible WebView that decodes
 *             QR codes from gallery images (see lib/QrFromImage.tsx).
 *             Vendored so the app makes zero runtime CDN calls — this
 *             backs the DSGVO posture described in docs/dependencies.md.
 *
 * The upstream copy is unminified webpack-UMD output (~250 KB). It ships
 * inside the JS bundle rather than being fetched at runtime.
 */
/* eslint-disable */
// prettier-ignore
export const JSQR_SOURCE = \``;

const footer = `\`;

/** Semver of the vendored jsQR copy — kept in sync by \`scripts/vendor-jsqr.mjs\`. */
export const JSQR_VERSION = ${JSON.stringify(pkg.version)};
`;

const out = header + source + footer;
writeFileSync(TARGET_PATH, out, 'utf-8');

console.log(`Wrote ${TARGET_PATH} (${out.length} bytes, jsQR v${pkg.version}).`);
