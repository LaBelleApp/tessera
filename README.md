# ✦ Tessera

**The mosaic of everything we build.** An internal map of our tools, projects, skills,
packages and ideas — what exists, how mature it is, what it's for, and how the pieces
connect. Each thing is a *tessera* (a tile); together they form the mosaic.

Built for: onboarding new devs, discovering whether a tool already exists for a problem,
and an internal/external showcase of what the team has produced.

---

## How it works

```
each repo                          this repo
┌────────────────┐                 ┌──────────────────────────────┐
│ tessera.yaml   │ ─── scan ───▶   │ scripts/aggregate.mjs        │
└────────────────┘                 │   → docs/data.json           │
backlog issues                     │ docs/index.html (the mosaic) │
(label: fragment) ─── scan ───▶    │ taxonomy.json (the vocab)    │
                                   └──────────────────────────────┘
                                            │ GitHub Pages (/docs)
                                            ▼
                                     the live mosaic
```

A tile lives wherever its code lives: drop a **`tessera.yaml`** next to it. Each repo is
scanned **recursively**, so a manifest can sit at the root *or* in any subfolder — one repo
can therefore hold many tiles (see "Many tiles in one repo" below). A weekly local run scans
the org, reads every manifest plus the idea issues, validates them, and writes `docs/data.json`.
Commit, push, done — Pages serves `docs/`.

Each tile declares only its **outgoing** seams (`uses`, `partOf`).
*Relied on by* and *Contains* are computed for you — never write them by hand.

---

## Weekly routine

```bash
export GITHUB_TOKEN=ghp_xxx        # read-only PAT, scopes: repo (read) + read:org
npm install                        # first time only
npm run build                      # scan GitHub → docs/data.json
git add docs/data.json && git commit -m "refresh mosaic" && git push
```

Preview locally before pushing:

```bash
npm run serve                      # → http://localhost:4173
```

> The site fetches `data.json` over HTTP, so open it via `npm run serve` or Pages —
> not by double-clicking the file (browsers block `fetch` on `file://`).

---

## Adding things

**A real tile** — add `tessera.yaml` to the repo root (see [`examples/tessera.example.yaml`](examples/tessera.example.yaml));
or run the `tessera-manifest-gen` skill to generate it. Required: `id, name, type, status, owner, summary, whenToUse`.

**A fragment (idea)** — open an issue in the backlog repo with the *Fragment* template
(label `fragment`). No repo, no manifest. It shows up as a translucent, unset tile.
When it becomes real, create the repo + manifest and close the issue.

### Setting up the fragment backlog (one-time)

Fragments live as GitHub issues in a dedicated, otherwise-empty repo. To set it up:

1. **Create the repo** in the org, e.g. `tessera-backlog` (it holds issues only — no code).
2. **Enable Issues** on it: *Settings → General → Features → ✅ Issues*. (If Issues are off,
   the API returns `404` and the build skips fragments with a warning.)
3. **Add the issue form** at `.github/ISSUE_TEMPLATE/fragment.yml` — copy this repo's
   [`.github/ISSUE_TEMPLATE/fragment.yml`](.github/ISSUE_TEMPLATE/fragment.yml) into it. Its
   `Field` dropdown must list the same keys as `taxonomy.json`.
4. **Create the `fragment` label** (any colour) so it can be applied to the issues.
5. **Point the config** at it in `tessera.config.json`:
   ```json
   "fragments": { "enabled": true, "repo": "<org>/tessera-backlog", "label": "fragment" }
   ```

The token used by `npm run build` needs read access to that repo (it's covered by `repo`/
`read:org` on a PAT). From then on, every open `fragment`-labelled issue becomes a tile.

### Many tiles in one repo (skills monorepo)

Small things — skills, little packages — don't deserve a repo each. Put them in **one
monorepo**, one folder per item, each with its own `tessera.yaml` beside its code:

```
skills/
├── tessera-manifest-gen/
│   ├── SKILL.md
│   └── tessera.yaml
├── doc-gen/
│   ├── SKILL.md
│   └── tessera.yaml
└── changelog-bot/
    ├── SKILL.md
    └── tessera.yaml
```

The recursive scan picks up every manifest. Each tile keeps its **own** freshness (last commit
touching *its* folder) and a deep link straight to that folder — not the repo root. To generate
one, point the skill at the subfolder (see below).

---

## Generating manifests with the `tessera-manifest-gen` skill

The skill writes a valid `tessera.yaml` for you: it inspects a repo (or a subfolder), drafts
every field, maps dependencies to existing tiles, and asks only for what it can't detect
(status, owner). It lives in [`skills/tessera-manifest-gen/`](skills/tessera-manifest-gen/);
`detect.mjs` is dependency-free, so it runs from any folder.

**Install (Cowork).** Open `skills/tessera-manifest-gen.skill` and click *Save skill*. After
editing the skill, rebuild the bundle with `npm run pack-skill` and reinstall.

**One-time setup (recommended).** Point the skill at the mosaic. Add to your shell profile
(`~/.zshrc`) — a local path **or** an https URL, never hard-coded in the skill:

```bash
export TESSERA_DATA="$HOME/Documents/Wayup/tessera/docs/data.json"   # local file
# once the site is published, you can instead use its data.json URL:
# export TESSERA_DATA="https://<org>.github.io/tessera/data.json"
```

This one variable covers both needs: the **known ids** (to suggest `uses`) and, from the
`taxonomy.json` sitting next to it, the **allowed fields/states** — so the skill knows the
vocabulary even when run in another repo. Override the taxonomy source separately with
`TESSERA_TAXONOMY` if ever needed.

Without it the manifest is still generated, but the skill won't see the vocabulary or suggest
seams — so set it, or run the skill inside the Tessera repo (where `taxonomy.json` lives).
Either way the central `npm run build` re-validates every manifest as the final guardrail.
(Early on, `uses` suggestions are sparse: ids only exist once their manifests do, and grow each
time you re-run the build.)

**Use it.** From the repo — or the subfolder of a monorepo — you want to onboard, ask Claude:

> "add this repo to Tessera"

It runs the detector, confirms the few uncertain fields with you, writes `tessera.yaml`, and
validates it. To run the detector yourself:

```bash
node <path-to>/detect.mjs .                  # current folder; uses $TESSERA_DATA if set
node <path-to>/detect.mjs ./skills/doc-gen   # a subfolder (monorepo) — id + deep link derived from it
node <path-to>/detect.mjs . "$TESSERA_DATA"  # or pass the data source (path or URL) explicitly
```

Then validate from the Tessera repo root and commit the manifest in the target repo:

```bash
node scripts/validate.mjs <TARGET>/tessera.yaml   # → ✓ … is valid
```

The new tile appears on the mosaic at the next `npm run build` + push.

---

## Configuration

`tessera.config.json`:

| key | meaning |
|-----|---------|
| `org` | GitHub org to scan for `tessera.yaml` (all non-archived repos) |
| `repos` | extra `owner/repo` to pin (e.g. outside the org) |
| `manifestPath` | manifest filename (default `tessera.yaml`) |
| `fragments` | `{ enabled, repo, label }` — where idea issues live |
| `output` | where `data.json` is written (default `docs/data.json`) |

## Taxonomy (fields & states)

`taxonomy.json` is the single source of truth for the vocabulary. Adding a **field** (galaxy)
or **state** = one entry here, no code change: it drives the legend, colours, tile rendering,
and manifest validation. Keep `state` a shared, fixed set; add `field`s deliberately (via PR)
so the mosaic doesn't sprawl into one-tile galaxies.

Encoding: tile **colour** = field · tile **size** = incoming dependencies (load-bearing things
grow) · **glow/opacity** = state · gold **seam** = a link (solid `uses`, dashed `partOf`).

### When you add / remove / rename a field or state

Most of the app reads `taxonomy.json` at runtime, but a few spots reference the keys by hand
and must be kept in sync:

1. **`taxonomy.json`** — add/remove the entry. A new **field** needs a distinct `color`.
2. **`.github/ISSUE_TEMPLATE/fragment.yml`** — sync the *Field* dropdown options (fields only).
   Update it in **both** this repo **and** the `tessera-backlog` repo.
3. **`skills/tessera-manifest-gen/detect.mjs`** — update the `typeGuess` (fields) / `statusGuess`
   (states) heuristics if the changed key is one they emit, then `npm run pack-skill` + reinstall.
4. **Existing `tessera.yaml` manifests** — migrate any that use a removed/renamed key. The next
   `npm run build` rejects unknown values and logs them, so it tells you which to fix.
5. **`scripts/aggregate.mjs`** — only if you rename the special **`fragment`** state key (it's
   referenced by name when turning issues into tiles).
6. **`scripts/demo/make-demo.mjs`** — only if you still use the demo; update keys, then `npm run demo`.

No change needed in the site (`docs/index.html`) or `scripts/validate.mjs` — both read
`taxonomy.json` dynamically.

---

## Deploy (GitHub Pages)

Repo *Settings → Pages → Deploy from a branch → `main` / `/docs`*. Every push that updates
`docs/` republishes the mosaic. No CI required.

## Demo data

`npm run demo` writes a sample `docs/data.json` (no GitHub needed) so the site renders
out of the box. Replace it with a real `npm run build` once your token and config are set.

## Layout

```
tessera/
├── taxonomy.json            # vocabulary: fields + states (source of truth)
├── tessera.config.json      # what to scan
├── examples/tessera.example.yaml  # the manifest spec, commented (ignored by the scan)
├── .github/ISSUE_TEMPLATE/fragment.yml
├── scripts/
│   ├── aggregate.mjs        # the weekly job (npm run build)
│   ├── github.mjs           # Octokit helpers
│   ├── validate.mjs         # manifest validation (npm run validate)
│   ├── serve.mjs            # local preview (npm run serve)
│   └── demo/make-demo.mjs   # sample data (npm run demo)
├── skills/
│   └── tessera-manifest-gen/        # skill: generate a tessera.yaml from a repo
│       ├── SKILL.md
│       └── detect.mjs       # repo signals: type, deps → uses, links
└── docs/                    # ← GitHub Pages root
    ├── index.html           # the mosaic
    ├── data.json            # generated
    └── taxonomy.json        # generated copy
```
