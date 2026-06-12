# Tessera MCP

Gives an AI agent the same catalog the mosaic shows — so it can find a package,
a skill or a tool that already exists, look up a project's relations, or mirror
the standards of an existing project on a new one.

It reads the **same `data.json`** the site does, so there is one source of truth for
humans (the mosaic) and agents (this server).

## Tools

| tool | what it does |
|------|--------------|
| `tessera_search(query, type?, tag?, limit?)` | discover tesserae by free text / type / tag |
| `tessera_get(id)` | one tessera + its relations (depends on, part of, relied on by, contains) + links |
| `tessera_list(type?)` | list everything, or all of one type (e.g. all skills) |
| `tessera_standards(id)` | the stack a project is built on (transitive deps + repo/doc links) to replicate its norms |
| `tessera_stats()` | catalog overview: totals, by type, by state, last assembled |

## Data source

`TESSERA_DATA` — a **local path** *or* an **https URL** (default `docs/data.json`):

```bash
export TESSERA_DATA="$HOME/Documents/Wayup/tessera/docs/data.json"   # local clone
# or the published mosaic, always up to date with the last push:
# export TESSERA_DATA="https://<org>.github.io/tessera/data.json"
```

It re-reads the source at most every 30s, so the data refreshes underneath without
ever touching the server — it just needs the path/URL to stay stable.

---

## Option A — Desktop Extension `.mcpb` (recommended · one click, no JSON)

This is Anthropic's recommended way to install a local MCP server in Claude Desktop / Cowork.
The repo keeps the **source** (`manifest.json` + the server); the `.mcpb` is a **build artifact**
you pack on demand (not committed) and install through the UI.

**1. Build the bundle** (from the repo root):
```bash
npm run pack-mcpb        # → mcp/tessera.mcpb
```
(That just runs `cd mcp && npm install --omit=dev && npx @anthropic-ai/mcpb pack` — it installs
the server's deps into `mcp/node_modules` and zips everything into the `.mcpb`.)

**2. Install it** in Claude Desktop / Cowork:
- *Settings → Extensions → Advanced settings → **Install Extension…***
- pick `mcp/tessera.mcpb`
- when prompted, set **Tessera data source** to your local `docs/data.json` path **or** the
  published URL (`https://<org>.github.io/tessera/data.json`)
- the tools are now available in your conversations. Verify via the **+** menu → *Connectors*.

Claude Desktop ships its own Node runtime, so nothing else is needed. After editing the server,
re-run `npm run pack-mcpb` and re-install the new `.mcpb`.

---

## Option B — stdio via JSON config (manual)

If you'd rather wire it by hand. The AI client launches the server on demand (no daemon),
so it's also "install once, survives reboots".

**Claude Code**
```bash
claude mcp add tessera -e TESSERA_DATA="$HOME/Documents/Wayup/tessera/docs/data.json" \
  -- node "$HOME/Documents/Wayup/tessera/mcp/server.mjs"
```

**Claude Desktop / Cowork** — open the config via *Claude menu (macOS menu bar) → Settings →
Developer → Edit Config*, then add (merge into any existing `mcpServers`):
```json
{
  "mcpServers": {
    "tessera": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/tessera/mcp/server.mjs"],
      "env": { "TESSERA_DATA": "/ABSOLUTE/PATH/tessera/docs/data.json" }
    }
  }
}
```
Fully quit (Cmd+Q) and reopen. If it won't start (nvm), replace `"node"` with the absolute path
from `which node`. Test locally first: `npm run mcp` (it waits on stdin — that's normal).

---

## Option C — HTTP daemon (always-on background service)

A real service on a port (default `4319`), started at login, restarted on crash.
This is also the exact shape you'll later host remotely.

```bash
npm run mcp:http      # foreground test → http://localhost:4319/mcp
```

Make it a managed service (auto-start at boot):

- **macOS (launchd):** edit `mcp/deploy/dev.labelleapp.tessera-mcp.plist` (replace
  `__NODE__`, `__REPO__`, `__DATA__`), then:
  ```bash
  cp mcp/deploy/dev.labelleapp.tessera-mcp.plist ~/Library/LaunchAgents/
  launchctl load -w ~/Library/LaunchAgents/dev.labelleapp.tessera-mcp.plist
  ```
- **Linux (systemd user):** edit `mcp/deploy/tessera-mcp.service`, then:
  ```bash
  cp mcp/deploy/tessera-mcp.service ~/.config/systemd/user/
  systemctl --user daemon-reload && systemctl --user enable --now tessera-mcp
  loginctl enable-linger "$USER"
  ```

Point a client at the URL (if it supports HTTP MCP):
```json
{ "mcpServers": { "tessera": { "url": "http://localhost:4319/mcp" } } }
```

---

## Hosting later

The HTTP server is stateless, so deploying it is just running `node mcp/server.mjs --http`
behind any reverse proxy, with `TESSERA_DATA` pointing at the published `data.json`.
Nothing in the client config changes except the URL.
