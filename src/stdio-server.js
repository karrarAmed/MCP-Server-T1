import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCalMcpServer } from './create-cal-mcp-server.js';
import { log } from './logger.js';

async function main() {
  try {
    const server = createCalMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info('stdio', 'Cal.com MCP stdio transport ready');
  } catch (e) {
    log.error('stdio', 'Failed to start', e);
    process.exit(1);
  }
}

main();
