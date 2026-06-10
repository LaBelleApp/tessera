---
name: tessera-manifest-gen
description: Generate or update a tessera.yaml manifest so a repo appears on the Tessera mosaic. Use when the user wants to "add this repo to Tessera", "onboard a repo to the mosaic", "generate a tessera.yaml", "create a tessera manifest", or place a tool/project/skill/package on the map. Infers the fields from the repo (type, dependencies, links), asks only for what can't be detected (status, owner), validates against the taxonomy, and writes the file at the repo root.
---

# tessera-manifest-gen

Generate a valid `tessera.yaml` for a repository so it becomes a tile on the Tessera mosaic.
A tile declares only its **outgoing** seams (`uses`, `partOf`); *relied on by* / *contains*
are computed by the aggregator — never write them.

> This skill is for **real tiles** (code). Ideas with no code are **fragments** — those are
> captured as GitHub issues with the `fragment` label, not with this skill.

> **One repo can hold many tiles.** A repo is scanned recursively, so a `tessera.yaml` can live
> in any subfolder. For a skill or package inside a **monorepo**, point `<TARGET>` at its
> *subfolder* (e.g. `skills/doc-gen`): the id and the deep link are derived from that folder,
> and you write the manifest *inside* it.

## Workflow

1. **Locate the target.** Ask which repo — or which **subfolder** of a monorepo — to onboard
   if it isn't obvious (a local path, or the current directory). Call it `<TARGET>`.

2. **Run detection** on the target. `detect.mjs` is self-contained (Node builtins only), so it
   runs from anywhere — point it at the current folder:
   ```bash
   node <path-to>/detect.mjs <TARGET> [mosaic-data-source]
   ```
   The 2nd argument is **optional** and only powers `usesSuggested` (mapping dependencies to
   existing tile ids). Prefer the **`TESSERA_DATA` env var** — set once in the shell to a local
   path *or* an https URL of the mosaic's `data.json` — then omit the argument. You may also
   pass that path/URL explicitly as the 2nd argument. Never hard-code a URL here.

   Omit it entirely and the manifest is still generated correctly — you just fill `uses` from
   the description instead of getting auto-suggestions.

   It prints JSON: `idGuess`, `nameGuess`, `repoUrl` (deep-linked to the subfolder), `subpath`,
   `ecosystem`, `typeGuess`, `statusGuess`, `ownerHint`, `usesSuggested`, `dependencies`,
   `taxonomy` (the allowed `fields`/`states`), `typeAllowed`, `readmeExcerpt`, and
   `existingManifest` (if a manifest is already there).

3. **Use the allowed vocabulary.** Pick `type` from `taxonomy.fields` and `status` from
   `taxonomy.states` in the detector output — never invent a value outside those sets.
   If `taxonomy` is `null` (no `TESSERA_DATA`/`TESSERA_TAXONOMY` set and not run inside the
   Tessera repo), read the Tessera repo's `taxonomy.json` directly, or ask the user for the
   source. A genuinely new field is a deliberate taxonomy change (a PR on `taxonomy.json`),
   not a one-off. The central `npm run build` re-validates every manifest, so it's the final
   guardrail if a wrong value slips through.

4. **Draft the manifest.** Fill each field:
   - `id` ← `idGuess` (kebab-case, stable, matches the repo).
   - `name` ← `nameGuess`, refined to how the team actually calls it.
   - `type` ← `typeGuess` — but treat it as a guess; confirm with the user.
   - `status` ← `statusGuess` — **always** confirm; maturity is a human call.
   - `owner` ← `ownerHint` if present, else ask (a person or team).
   - `summary` ← one line, drafted from `readmeExcerpt`: *what it is*.
   - `whenToUse` ← one line: *when to reach for it* (the discovery hook).
   - `uses` ← `usesSuggested` (dependencies that matched existing tile ids). Review them;
     keep only true hard dependencies. Add any obvious missing ones.
   - `partOf` ← set only for composition (e.g. a package that is part of a framework), else `null`.
   - `tags` ← a few free labels for implicit grouping (optional).
   - `links` ← `{ repo: <repoUrl> }`, plus `doc` / `demo` if known.

5. **Confirm the uncertain fields with the user** in a single concise question:
   `type`, `status`, `owner`, and the drafted `summary` / `whenToUse`. Present your drafts
   as defaults so it's a quick yes/adjust — don't interrogate field by field.

6. **Write** the file at `<TARGET>/tessera.yaml`, in this exact field order:
   `id, name, type, status, owner, summary, whenToUse, uses, partOf, tags, links`.
   Use [`examples/tessera.example.yaml`](../../examples/tessera.example.yaml) as the formatting reference.
   If `existingManifest` is present, update it in place rather than blindly overwriting —
   preserve human edits, only change what's needed.

7. **Validate** from the Tessera repo root and fix anything it flags:
   ```bash
   node scripts/validate.mjs <TARGET>/tessera.yaml
   ```
   Re-run until it prints `✓ … is valid`.

8. **Report**: confirm the tile id, type, status, and which seams (`uses`/`partOf`) were set,
   and remind the user it will appear after the next `npm run build` + push.

## Notes

- Required fields: `id, name, type, status, owner, summary, whenToUse`. The rest are optional.
- `id` must be kebab-case and stable — other tiles reference it in their `uses`/`partOf`.
- Keep `summary` and `whenToUse` to one line each. `whenToUse` is what makes the mosaic useful
  for discovery, so make it concrete ("Reference for a fintech project", not "A banking app").
