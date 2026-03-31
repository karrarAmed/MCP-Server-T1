import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createCalMcpServer } from './create-cal-mcp-server.js';
import { log } from './logger.js';

const transports = {};

function getPort() {
  const p = Number(process.env.MCP_HTTP_PORT || 3333);
  return Number.isFinite(p) ? p : 3333;
}

function getHost() {
  return process.env.MCP_HTTP_HOST || '127.0.0.1';
}

const app = createMcpExpressApp({ host: getHost() });

app.post('/mcp', async (req, res) => {
  try {
    const sessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

    let transport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          log.info('http', `MCP session initialized`, { sessionId: sid });
        },
      });
      const server = createCalMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: missing or invalid mcp-session-id' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    log.error('http', 'MCP POST error', e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', async (req, res) => {
  try {
    const sessionIdHeader = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing mcp-session-id');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  } catch (e) {
    log.error('http', 'MCP GET (SSE) error', e);
    if (!res.headersSent) res.status(500).send('Internal server error');
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cal-com-mcp' });
});

const PORT = getPort();
const HOST = getHost();

app.listen(PORT, HOST, (err) => {
  if (err) {
    log.error('http', 'listen failed', err);
    process.exit(1);
  }
  log.info('http', `Cal.com MCP (streamable HTTP + SSE) on http://${HOST}:${PORT}/mcp`);
  log.info('http', `Health: http://${HOST}:${PORT}/health`);
});

process.on('SIGINT', async () => {
  for (const id of Object.keys(transports)) {
    await transports[id].close().catch(() => {});
    delete transports[id];
  }
  process.exit(0);
});
