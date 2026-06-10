// github.mjs — Octokit helpers for the aggregator.
// Auth: process.env.GITHUB_TOKEN (read-only PAT is enough).
// A repo can carry MANY tesserae: we scan its whole tree for manifests at any depth.
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import yaml from 'js-yaml';
import path from 'node:path';

const ThrottledOctokit = Octokit.plugin(throttling);

export function makeClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set. Export a read-only PAT first.');
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      // Respect primary + secondary limits automatically, with a couple of retries.
      onRateLimit: (retryAfter, options, octo, retryCount) => {
        octo.log.warn(`Rate limit hit on ${options.method} ${options.url}; retrying in ${retryAfter}s`);
        return retryCount < 2;
      },
      onSecondaryRateLimit: (retryAfter, options, octo) => {
        octo.log.warn(`Secondary limit on ${options.method} ${options.url}; retrying in ${retryAfter}s`);
        return true;
      },
    },
  });
}

// All non-archived repos of an org (paginated).
export async function listOrgRepos(octo, org) {
  const repos = await octo.paginate(octo.repos.listForOrg, { org, per_page: 100, type: 'all' });
  return repos.filter(r => !r.archived);
}

// Repo metadata we need: default branch + web url + fallback date.
export async function getRepoMeta(octo, owner, repo) {
  const { data } = await octo.repos.get({ owner, repo });
  return { defaultBranch: data.default_branch, htmlUrl: data.html_url, pushedAt: data.pushed_at };
}

// Find every manifest in a repo, at any depth, with ONE recursive tree call.
// Returns a list of paths (e.g. "tessera.yaml", "skills/doc-gen/tessera.yaml").
export async function findManifestPaths(octo, owner, repo, branch, filename) {
  try {
    const { data } = await octo.git.getTree({ owner, repo, tree_sha: branch, recursive: '1' });
    if (data.truncated) console.warn(`! ${owner}/${repo}: tree truncated (very large repo) — some tiles may be missed`);
    return data.tree
      .filter(n => n.type === 'blob' && path.basename(n.path) === filename)
      .map(n => n.path);
  } catch (e) {
    if (e.status === 404 || e.status === 409) return []; // empty repo / missing branch
    throw e;
  }
}

// Fetch + parse a manifest at a precise path.
export async function getManifestAt(octo, owner, repo, filepath) {
  const { data } = await octo.repos.getContent({ owner, repo, path: filepath });
  const text = Buffer.from(data.content, data.encoding).toString('utf8');
  return yaml.load(text);
}

// Date of the last commit touching a given directory — per-tile freshness in a monorepo.
export async function getPathUpdatedAt(octo, owner, repo, dir, fallback) {
  try {
    const { data } = await octo.repos.listCommits({ owner, repo, path: dir || undefined, per_page: 1 });
    return data[0]?.commit?.committer?.date || data[0]?.commit?.author?.date || fallback;
  } catch {
    return fallback;
  }
}

// Open issues carrying the fragment label, in owner/repo.
export async function listFragmentIssues(octo, owner, repo, label) {
  const issues = await octo.paginate(octo.issues.listForRepo, {
    owner, repo, state: 'open', labels: label, per_page: 100,
  });
  return issues.filter(i => !i.pull_request);
}

// Parse a GitHub issue-form body ("### Label\n\nvalue") into a key/value map.
export function parseIssueForm(body = '') {
  const out = {};
  const parts = body.split(/^###\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const key = p.slice(0, nl).trim().toLowerCase();
    const val = p.slice(nl + 1).trim();
    out[key] = val === '_No response_' ? '' : val;
  }
  return out;
}
