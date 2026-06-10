// detect.mjs — scan a target repo and emit signals that help draft a tessera.yaml.
// Pure Node builtins (no deps), so it runs anywhere.
//
//   node skills/tessera-manifest-gen/detect.mjs <targetPath> [tesseraDataJson]
//
// arg1: path to the repo OR subfolder being onboarded (default: cwd).
//       A subfolder works too (e.g. a skill inside a monorepo) — the deep link
//       and id are derived from that folder.
// arg2: optional path to the mosaic's data.json, to suggest `uses` from dependencies
//
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const target = path.resolve(process.argv[2] || '.');
const dataPath = process.argv[3];

const exists = p => fs.existsSync(path.join(target, p));
const read = p => { try { return fs.readFileSync(path.join(target, p), 'utf8'); } catch { return null; } };
const kebab = s => s.toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
const title = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ---- identity ----
const repoName = path.basename(target);
const git = a => { try { return execSync(`git -C ${JSON.stringify(target)} ${a}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const gitRemote = git('remote get-url origin') || null;
const subpath = git('rev-parse --show-prefix').replace(/\/$/, '');   // '' when at repo root
const branch = git('rev-parse --abbrev-ref HEAD') || 'main';
let repoUrl = null;
if (gitRemote) {
  const m = gitRemote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (m) { repoUrl = 'https://github.com/' + m[1]; if (subpath) repoUrl += `/tree/${branch}/${subpath}`; }
}

// ---- ecosystem & dependencies ----
const deps = new Set();
let ecosystem = 'unknown', hasBin = false;

const pkgRaw = read('package.json');
if (pkgRaw) {
  ecosystem = 'node';
  try {
    const pkg = JSON.parse(pkgRaw);
    Object.keys(pkg.dependencies || {}).forEach(d => deps.add(d));
    Object.keys(pkg.devDependencies || {}).forEach(d => deps.add(d));
    if (pkg.bin) hasBin = true;
  } catch { /* malformed */ }
}
const pubspec = read('pubspec.yaml');
if (pubspec) {
  ecosystem = 'flutter';
  // light parse of the dependencies: block (keys at 2-space indent)
  const block = pubspec.split(/\n(?=\S)/).find(s => /^dependencies:/m.test(s)) || '';
  block.split('\n').forEach(l => { const m = l.match(/^\s{2}([a-zA-Z0-9_]+):/); if (m) deps.add(m[1]); });
}

// ---- structural signals ----
const sig = {
  skill: exists('SKILL.md'),
  flutterApp: !!pubspec && (exists('lib/main.dart') || exists('android') || exists('ios')),
  flutterPkg: !!pubspec && !(exists('lib/main.dart') || exists('android') || exists('ios')),
  cli: hasBin || exists('bin'),
  web: exists('index.html') || exists('public/index.html') || exists('docs/index.html'),
  hasTests: exists('test') || exists('tests') || exists('test_driver'),
  hasCI: exists('.github/workflows'),
  // only a clear top-of-README notice, not an incidental mention of the word
  archivedHint: /this (repo|repository|project) is (archived|deprecated|no longer)|no longer maintained|⚠️\s*(archived|deprecated)/i
    .test((read('README.md') || '').slice(0, 600)),
};

// ---- type guess ----
let typeGuess = 'experiment';
if (sig.skill) typeGuess = 'skill';
else if (sig.cli) typeGuess = 'tool-cli';
else if (sig.flutterApp) typeGuess = 'client-project';
else if (sig.flutterPkg) typeGuess = 'package';
else if (sig.web) typeGuess = 'internal-site';

// ---- status guess (always confirm with a human) ----
let statusGuess = 'in-dev';
if (sig.archivedHint) statusGuess = 'archived';
else if (sig.hasTests && sig.hasCI) statusGuess = 'working';
else if (sig.hasTests || sig.hasCI) statusGuess = 'testing';

// ---- owner hint (CODEOWNERS) ----
let ownerHint = null;
const co = read('.github/CODEOWNERS') || read('CODEOWNERS') || read('docs/CODEOWNERS');
if (co) { const m = co.match(/@[\w/-]+/); if (m) ownerHint = m[0]; }

// ---- map dependencies → existing tile ids (suggest `uses`) ----
let knownIds = [];
if (dataPath) { try { knownIds = JSON.parse(fs.readFileSync(dataPath, 'utf8')).tesserae.map(t => t.id); } catch { /* ignore */ } }
const depKebabs = [...deps].map(kebab);
const usesSuggested = knownIds.filter(id => id !== kebab(repoName) && depKebabs.includes(id));

// ---- existing manifest? ----
const existingManifest = read('tessera.yaml');

console.log(JSON.stringify({
  target,
  idGuess: kebab(repoName),
  nameGuess: title(repoName),
  repoUrl,
  gitRemote,
  subpath,
  ecosystem,
  typeGuess,
  statusGuess,
  ownerHint,
  signals: sig,
  dependencies: [...deps],
  usesSuggested,
  knownIdsCount: knownIds.length,
  existingManifest,
  readmeExcerpt: (read('README.md') || '').split('\n').filter(Boolean).slice(0, 12).join('\n'),
}, null, 2));
