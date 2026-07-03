/**
 * Data-minimisation regression test — proves "no third-party tracking".
 *
 * Two assertions:
 *   1. No known tracking package name appears in `package.json` under
 *      `dependencies` or `devDependencies`.
 *   2. No source file under `app/`, `lib/`, `components/`, `constants/`
 *      imports a tracking module.
 *
 * When a new tracking name enters the ecosystem, extend `TRACKING_PATTERNS`;
 * the test will fail if any current dep or import matches.
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
          const importRegex = new RegExp(`(?:import[^;]+from\\s+|require\\s*\\()['"]([^'"]*${pattern}[^'"]*)['"]`, 'i');
          if (importRegex.test(content)) {
            violations.push(`${path.relative(REPO_ROOT, file)} imports something containing "${pattern}"`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
