/**
 * Quick check that CAL_API_KEY works against Cal.com (no MCP).
 * Run: node scripts/smoke-cal.mjs
 */
import 'dotenv/config';
import { createCalClient } from '../src/cal-api.js';

const key = process.env.CAL_API_KEY;
if (!key) {
  console.error('Set CAL_API_KEY in .env');
  process.exit(1);
}

const cal = createCalClient(key);
const out = await cal.listEventTypes({});
console.log(JSON.stringify(out, null, 2));
