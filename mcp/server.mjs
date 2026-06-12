// Tessera MCP server — gives an agent the same catalog the site shows.
// Transports:
//   node mcp/server.mjs           → stdio (the AI client spawns it on demand)
//   node mcp/server.mjs --http    → streamable HTTP daemon on $PORT (default 4319)
// Data source: $TESSERA_DATA (a local path OR an https URL); default docs/data.json.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as cat from './data.mjs';

const text = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const orError = (r, id) => r ? text(r) : text({ error: `No tessera with id "${id}"` });

function buildServer() {
  const server = new McpServer({ name: 'tessera', version: '0.1.0' });

  server.registerTool('tessera_search', {
    title: 'Search the mosaic',
    description: 'Find tesserae (projects, packages, skills, tools, frameworks…) by free text, optionally filtered by field type or tag. Use this FIRST to discover whether something already exists before building it.',
    inputSchema: {
      query: z.string().describe('free text; matches name, id, summary, when-to-use, owner, tags'),
      type: z.string().optional().describe('field key, e.g. package, skill, framework, client-app'),
      tag: z.string().optional().describe('exact tag to filter by'),
      limit: z.number().int().optional().describe('max results (default 20)'),
    },
  }, async ({ query, type, tag, limit }) => text(await cat.search(query, { type, tag, limit })));

  server.registerTool('tessera_get', {
    title: 'Get a tessera',
    description: 'Full record for one tessera by id, including its relations (depends on, part of, relied on by, contains) and repo/doc links.',
    inputSchema: { id: z.string().describe('the tessera id, e.g. aio') },
  }, async ({ id }) => orError(await cat.get(id), id));

  server.registerTool('tessera_list', {
    title: 'List tesserae',
    description: 'List every tessera, optionally restricted to one field type (e.g. all skills, all packages, all frameworks).',
    inputSchema: { type: z.string().optional().describe('field key to filter by') },
  }, async ({ type }) => text(await cat.list(type)));

  server.registerTool('tessera_standards', {
    title: 'Project standards / stack',
    description: 'Given a project id, return the stack it is built on — its transitive dependencies (framework, packages, templates) with repo/doc links — so an agent can mirror the same standards on a new project. Use when the user says "follow the same norms as project X". Tessera routes to WHERE the conventions live; read those repos/docs for the actual rules.',
    inputSchema: { id: z.string().describe('the project tessera id') },
  }, async ({ id }) => orError(await cat.standards(id), id));

  server.registerTool('tessera_stats', {
    title: 'Catalog overview',
    description: 'High-level snapshot of the catalog: totals, counts by type and state, and when the mosaic was last assembled.',
    inputSchema: {},
  }, async () => text(await cat.stats()));

  return server;
}

async function runStdio() {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  console.error('tessera MCP (stdio) ready · data:', process.env.TESSERA_DATA || 'docs/data.json');
}

async function runHttp() {
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const http = await import('node:http');
  const PORT = process.env.PORT || 4319;
  const server = http.createServer(async (req, res) => {
    if ((req.url || '').split('?')[0] !== '/mcp') { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    if (req.method !== 'POST') { // stateless: only POST carries JSON-RPC
      res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'POST' })
        .end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server: use POST).' }, id: null }));
      return;
    }
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || '{}') : undefined;
      const mcp = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => { transport.close(); mcp.close(); });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      console.error('request error:', e);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
    }
  });
  server.listen(PORT, () => console.error(`tessera MCP (http) on http://localhost:${PORT}/mcp · data:`, process.env.TESSERA_DATA || 'docs/data.json'));
}

(process.argv.includes('--http') ? runHttp() : runStdio()).catch(e => { console.error(e); process.exit(1); });
