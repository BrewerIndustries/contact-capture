#!/usr/bin/env node
// Bootstrap: create a user (normally the first admin) and print a one-time invite
// link. After that, admins invite everyone else from Settings → Users.
//
//   SESSION_SECRET=... npm run invite -- --env dev --email you@example.com --role admin
//   npm run invite -- --local --email you@example.com --role admin      (reads .dev.vars)
//
// The token is stored as HMAC-SHA256(token, SESSION_SECRET), the same as the Worker
// does, so the secret must match the one set on the target Worker.

import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function parse(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const args = parse(process.argv.slice(2));
const env = args.env === 'dev' ? 'dev' : 'prod';
const email = String(args.email || '').trim().toLowerCase();
const role = args.role === 'user' ? 'user' : 'admin';
const name = args.name ? String(args.name) : null;
const dbName = env === 'dev' ? 'contact-capture-dev' : 'contact-capture-prod';

let secret = process.env.SESSION_SECRET;
let appUrl = env === 'dev' ? 'https://contacts.dabrewer.dev/dev/' : 'https://contacts.dabrewer.dev/';
if (args.local) {
  const vars = Object.fromEntries(readFileSync('.dev.vars', 'utf8').split('\n')
    .filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  secret ||= vars.SESSION_SECRET;
  appUrl = vars.APP_URL || 'http://localhost:5173/';
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !secret) {
  console.error('Usage: SESSION_SECRET=... npm run invite -- --email <email> [--role admin|user] [--env prod|dev] [--name "..."] [--local]');
  process.exit(1);
}

const raw = randomBytes(32).toString('base64url');
const tokenId = createHmac('sha256', secret).update(raw).digest('hex');
const id = randomUUID();
const now = Date.now();
const q = (s) => (s === null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

const sql =
  `INSERT INTO users (id,email,role,display_name,created_at) VALUES (${q(id)},${q(email)},${q(role)},${q(name)},${now});` +
  `INSERT INTO tokens (id,kind,user_id,created_by,created_at,expires_at) VALUES (${q(tokenId)},'invite',${q(id)},NULL,${now},${now + 72 * 3600 * 1000});`;

const wranglerArgs = ['wrangler', 'd1', 'execute', dbName];
if (env === 'dev') wranglerArgs.push('--env', 'dev');
wranglerArgs.push(args.local ? '--local' : '--remote', '--command', sql);

console.log(`Creating ${role} "${email}" in ${dbName}${args.local ? ' (local)' : ''}...`);
execFileSync('npx', wranglerArgs, { stdio: ['ignore', 'ignore', 'inherit'] });
console.log(`\nInvite link (one use, 72h):\n${appUrl}accept?token=${raw}\n`);
