#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { WORKLOADS } = require('../lib/workloads');
const { CLOUDS } = require('../lib/clouds');
const { buildCommands, buildPlan, DEFAULT_REPO } = require('../lib/plan');
const { validateDeployment } = require('../lib/validate');
const { signIn } = require('../lib/auth');
const { runDeployment } = require('../lib/deploy');

const port = Number(process.env.PORT || 4173);
const publicDir = path.join(__dirname, 'public');

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/**
 * Serialize cloud/workload metadata for the browser. Subscriptions are NOT
 * included here — they are only returned after the (simulated) SSO sign-in.
 */
function buildOptions() {
  return {
    defaultRepo: DEFAULT_REPO,
    workloads: WORKLOADS.map((w) => ({
      key: w.key,
      title: w.title,
      description: w.description,
      path: w.path,
    })),
    clouds: CLOUDS.map((c) => ({
      key: c.key,
      title: c.title,
      description: c.description,
      cli: c.cli,
      terms: c.terms,
      regions: c.regions.map((r) => ({ id: r.id, name: r.name, zones: r.zones })),
    })),
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  // Prevent path traversal: resolve within publicDir and verify the prefix.
  const resolved = path.normalize(path.join(publicDir, urlPath));
  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const type = STATIC_TYPES[path.extname(resolved)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
    res.end(data);
  });
}

async function handleSignin(req, res) {
  try {
    const raw = await readBody(req);
    const input = raw ? JSON.parse(raw) : {};
    const result = signIn(input.cloud);
    if (!result) {
      sendJson(res, 400, { ok: false, errors: ['Unknown cloud.'] });
      return;
    }
    sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    sendJson(res, 400, { ok: false, errors: [String(err.message || err)] });
  }
}

async function handlePlan(req, res) {
  try {
    const raw = await readBody(req);
    const input = raw ? JSON.parse(raw) : {};
    const { errors, answers } = validateDeployment(input);

    if (errors.length) {
      sendJson(res, 400, { ok: false, errors });
      return;
    }

    answers.source = { repoUrl: DEFAULT_REPO, branch: 'main' };
    const plan = buildPlan(answers);
    const commands = buildCommands(answers);
    const script = `#!/usr/bin/env bash\nset -euo pipefail\n\n${commands.join('\n')}\n`;

    sendJson(res, 200, { ok: true, plan, commands, script });
  } catch (err) {
    sendJson(res, 400, { ok: false, errors: [String(err.message || err)] });
  }
}

async function handleDeploy(req, res) {
  try {
    const raw = await readBody(req);
    const input = raw ? JSON.parse(raw) : {};
    const { errors, answers } = validateDeployment(input);

    if (errors.length) {
      sendJson(res, 400, { ok: false, errors });
      return;
    }

    answers.source = { repoUrl: DEFAULT_REPO, branch: 'main' };
    const deployment = runDeployment(answers);
    sendJson(res, 200, { ok: true, deployment });
  } catch (err) {
    sendJson(res, 400, { ok: false, errors: [String(err.message || err)] });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/api/options' || req.url.startsWith('/api/options?'))) {
    sendJson(res, 200, buildOptions());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/signin') {
    handleSignin(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/plan') {
    handlePlan(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/deploy') {
    handleDeploy(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' }).end('Method not allowed');
});

server.listen(port, () => {
  console.log(`courier web UI listening on http://localhost:${port}`);
});

module.exports = { server, buildOptions };
