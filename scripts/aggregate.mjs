// aggregate.mjs — the weekly job.
// Scans GitHub (org + pinned repos), reads tessera.yaml manifests and fragment
// issues, validates everything against the taxonomy, then writes docs/data.json
// (+ a copy of taxonomy.json next to it for the site).
//
//   GITHUB_TOKEN=ghp_xxx  npm run build
//
import fs from 'node:fs';
import path from 'node:path';
import {
  makeClient, listOrgRepos, getRepoMeta, findManifestPaths, getManifestAt,
  getPathUpdatedAt, listFragmentIssues, parseIssueForm,
} from './github.mjs';
import { loadTaxonomy, validateManifest, checkSeams } from './validate.mjs';

const ROOT = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'tessera.config.json'), 'utf8'));
const taxonomy = loadTaxonomy(ROOT);

function normalize(m, extra) {
  return {
    id: m.id, name: m.name, type: m.type, status: m.status, owner: m.owner,
    summary: m.summary, whenToUse: m.whenToUse,
    uses: m.uses || [], partOf: m.partOf || null,
    tags: m.tags || [], links: m.links || {},
    isFragment: false,
    ...extra,
  };
}

async function collectManifests(octo) {
  const targets = [];
  if (config.org) {
    const repos = await listOrgRepos(octo, config.org);
    const priv = repos.filter(r => r.private).length;
    console.log(`Org ${config.org}: ${repos.length} repos visible — ${priv} private, ${repos.length - priv} public`);
    if (repos.length && priv === 0) {
      console.warn('! 0 private repos visible. If you expected some, the token lacks private access:');
      console.warn('  fine-grained PAT → org must APPROVE it, Repository access = All repositories, perms Contents+Metadata+Issues (read). See README → "GitHub token".');
    }
    repos.forEach(r => targets.push([r.owner.login, r.name]));
  }
  for (const full of config.repos || []) {
    const [owner, name] = full.split('/');
    if (owner && name) targets.push([owner, name]);
  }

  const filename = config.manifestPath;        // matched at ANY depth (one repo → many tiles)
  const tesserae = [];
  let scanned = 0;
  for (const [owner, repo] of targets) {
    scanned++;
    let meta;
    try { meta = await getRepoMeta(octo, owner, repo); }
    catch (e) { console.warn(`! ${owner}/${repo}: ${e.message}`); continue; }

    const paths = await findManifestPaths(octo, owner, repo, meta.defaultBranch, filename);
    for (const filepath of paths) {
      let m;
      try { m = await getManifestAt(octo, owner, repo, filepath); }
      catch (e) { console.warn(`! ${owner}/${repo}/${filepath}: ${e.message}`); continue; }

      const { ok, errors } = validateManifest(m, taxonomy);
      if (!ok) { console.warn(`✗ ${owner}/${repo}/${filepath} invalid:`); errors.forEach(e => console.warn('   - ' + e)); continue; }

      const dir = path.posix.dirname(filepath);
      const subdir = dir === '.' ? '' : dir;     // '' = repo root
      const updatedAt = await getPathUpdatedAt(octo, owner, repo, subdir, meta.pushedAt);
      const deepLink = subdir ? `${meta.htmlUrl}/tree/${meta.defaultBranch}/${subdir}` : meta.htmlUrl;
      const links = { repo: deepLink, ...(m.links || {}) };

      tesserae.push(normalize(m, { updatedAt, links }));
      console.log(`✓ ${owner}/${repo}${subdir ? '/' + subdir : ''} → ${m.id}`);
    }
  }
  return { tesserae, scanned };
}

async function collectFragments(octo) {
  const cfg = config.fragments;
  if (!cfg || !cfg.enabled) return [];
  const [owner, repo] = cfg.repo.split('/');
  let issues;
  try {
    issues = await listFragmentIssues(octo, owner, repo, cfg.label);
  } catch (e) {
    if (e.status === 404) {
      console.warn(`! fragments skipped: ${cfg.repo} has Issues disabled, or the token can't see it. ` +
        `Enable Issues on that repo (Settings → Features), or set fragments.enabled=false.`);
      return [];
    }
    throw e;
  }
  return issues.map(issue => {
    const f = parseIssueForm(issue.body || '');
    const uses = (f['depends on (optional)'] || '').split(',').map(s => s.trim()).filter(Boolean);
    // an out-of-taxonomy field would break the site, so fall back to experiment
    let type = f['field'] || 'experiment';
    if (!taxonomy.fields.has(type)) {
      console.warn(`! fragment #${issue.number}: unknown field "${type}" → experiment`);
      type = 'experiment';
    }
    return {
      id: `fragment-${issue.number}`,
      name: f['name'] || issue.title.replace(/^\[fragment\]\s*/i, ''),
      type,
      status: 'fragment',
      owner: (issue.assignee && issue.assignee.login) || (issue.user && issue.user.login) || 'unassigned',
      summary: f['what it is'] || '',
      whenToUse: f['when would you use it'] || '',
      uses, partOf: null, tags: [],
      links: { repo: issue.html_url },
      updatedAt: issue.updated_at,
      isFragment: true,
    };
  });
}

async function main() {
  const octo = makeClient();
  try { const me = await octo.rest.users.getAuthenticated(); console.log(`Authenticated as ${me.data.login}`); }
  catch { console.warn('! Could not identify the token user (continuing).'); }
  console.log(`Scanning ${config.org ? 'org ' + config.org : ''} ${(config.repos || []).length} pinned repo(s)…`);
  const { tesserae, scanned } = await collectManifests(octo);
  const fragments = await collectFragments(octo);
  const all = [...tesserae, ...fragments];

  // integrity: dedupe ids + warn on dangling seams
  const seen = new Set();
  for (const t of all) {
    if (seen.has(t.id)) console.warn(`! duplicate id: ${t.id}`);
    seen.add(t.id);
  }
  checkSeams(all).forEach(w => console.warn('! ' + w));

  const out = {
    generatedAt: new Date().toISOString(),
    stats: {
      mode: config.org ? 'org' : 'repos',
      reposScanned: scanned,
      tesserae: tesserae.length,
      fragments: fragments.length,
    },
    tesserae: all,
  };

  const outPath = path.join(ROOT, config.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  fs.copyFileSync(path.join(ROOT, 'taxonomy.json'), path.join(path.dirname(outPath), 'taxonomy.json'));

  console.log(`\nWrote ${config.output}: ${all.length} tesserae (${fragments.length} fragments) from ${scanned} repos.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
