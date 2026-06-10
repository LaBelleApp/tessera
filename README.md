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

**A real tile** — add `tessera.yaml` to the repo root (see [`examples/tessera.yaml`](examples/tessera.yaml));
or run the `tessera-manifest-gen` skill to generate it. Required: `id, name, type, status, owner, summary, whenToUse`.

**A fragment (idea)** — open an issue in the backlog repo with the *Fragment* template
(label `fragment`). No repo, no manifest. It shows up as a translucent, unset tile.
When it becomes real, create the repo + manifest and close the issue.

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
one, point the skill at the subfolder: `node skills/tessera-manifest-gen/detect.mjs skills/doc-gen docs/data.json`.

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
├── examples/tessera.yaml    # the manifest spec, commented
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
