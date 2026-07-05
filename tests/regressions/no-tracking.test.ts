/**
 * Data-minimisation regression test — proves "no third-party tracking".
 *
 * Three assertions:
 *   1. No known tracking package name appears in `package.json` under
 *      `dependencies` or `devDependencies`.
 *   2. No source file under `app/`, `lib/`, `components/`, `constants/`
 *      imports a tracking module.
 *   3. No source file references a public CDN host at runtime — the app
 *      must fetch its assets from either the JS bundle or the backend at
 *      `hommrich.app`, never from jsDelivr, unpkg, Google Fonts, etc.
 *
 * When a new tracking name enters the ecosystem, extend `TRACKING_PATTERNS`;
 * the test will fail if any current dep or import matches. Same for CDN
 * hosts via `CDN_HOSTS`.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const TRACKING_PATTERNS: string[] = [
  'sentry',
  'crashlytics',
  '@react-native-firebase',
  'firebase-analytics',
  'segment',
  'mixpanel',
  'posthog',
  'amplitude',
  'google-analytics',
  'ga4',
  'appsflyer',
  'branch-io',
  'braze',
  'analytics',
  'tracker',
];

/**
 * Hostnames of public CDNs that must never appear in the source tree. The
 * `docs/` folder is allowed to mention them (context / history), but no
 * runtime source file may embed them.
 */
const CDN_HOSTS: string[] = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

function walkSource(dir: string, accum: string[] = []): string[] {
  if (!fs.existsSync(dir)) return accum;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSource(full, accum);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      accum.push(full);
    }
  }
  return accum;
}

describe('regressions/no-tracking', () => {
  it('no tracking dep appears in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const offenders: string[] = [];
    for (const name of Object.keys(allDeps)) {
      const lower = name.toLowerCase();
      for (const pattern of TRACKING_PATTERNS) {
        if (lower.includes(pattern)) offenders.push(`${name} (matches ${pattern})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no source file imports a tracking module', () => {
    const roots = ['app', 'lib', 'components', 'constants'];
    const violations: string[] = [];
    for (const root of roots) {
      const files = walkSource(path.join(REPO_ROOT, root));
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of TRACKING_PATTERNS) {
          // Only flag actual import/require statements; matching the same
          // string in a comment is fine (this test file itself would trip
          // otherwise).
          const importRegex = new RegExp(
            `(?:import[^;]+from\\s+|require\\s*\\()['"]([^'"]*${pattern}[^'"]*)['"]`,
            'i'
          );
          if (importRegex.test(content)) {
            violations.push(
              `${path.relative(REPO_ROOT, file)} imports something containing "${pattern}"`
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no source file references a public CDN host', () => {
    // We scan the same roots the app actually bundles — no `docs/`, no
    // `scripts/`, no `tests/`. Vendored third-party code lives under
    // `lib/vendor/` and is scanned too: we WANT to catch a CDN reference
    // that snuck in via a vendored library.
    const roots = ['app', 'lib', 'components', 'constants'];
    const offenders: string[] = [];
    for (const root of roots) {
      const files = walkSource(path.join(REPO_ROOT, root));
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const host of CDN_HOSTS) {
          if (content.includes(host)) {
            offenders.push(`${path.relative(REPO_ROOT, file)} references ${host}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
