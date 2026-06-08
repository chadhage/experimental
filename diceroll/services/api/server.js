const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const port = Number(process.env.PORT || 8081);

const containerName = process.env.AZURE_BLOB_CONTAINER || 'dicerolls';
const logBlobName = process.env.AZURE_BLOB_LOG_NAME || 'rolls.json';
const connectionString =
  process.env.AZURE_BLOB_CONNECTION_STRING ||
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);
const logBlobClient = containerClient.getBlockBlobClient(logBlobName);

// Serialize read-modify-write operations on the JSON log to avoid lost updates.
let writeChain = Promise.resolve();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

async function streamToString(readableStream) {
  if (!readableStream) {
    return '';
  }
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readLog() {
  try {
    const download = await logBlobClient.download();
    const content = await streamToString(download.readableStreamBody);
    if (!content.trim()) {
      return [];
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.statusCode === 404) {
      return [];
    }
    throw err;
  }
}

async function writeLog(entries) {
  const body = JSON.stringify(entries, null, 2);
  await logBlobClient.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

function appendRoll(record) {
  writeChain = writeChain.then(async () => {
    const entries = await readLog();
    entries.push(record);
    await writeLog(entries);
    return entries.length;
  });
  return writeChain;
}

function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i += 1) {
    rolls.push(crypto.randomInt(1, sides + 1));
  }
  return rolls;
}

app.get('/health', async (_req, res) => {
  try {
    await containerClient.createIfNotExists();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: String(err.message || err) });
  }
});

app.post('/api/roll', async (req, res) => {
  const count = Math.min(Math.max(Number(req.body?.count || 2), 1), 20);
  const sides = Math.min(Math.max(Number(req.body?.sides || 6), 2), 100);
  const rolledByRaw = req.body?.rolledBy || req.header('x-rolled-by') || 'anonymous';
  const rolledBy = String(rolledByRaw).trim().slice(0, 200) || 'anonymous';
  const clientIp = getClientIp(req).slice(0, 100);
  const rolledAt = new Date().toISOString();
  const rolls = rollDice(count, sides);
  const total = rolls.reduce((sum, value) => sum + value, 0);

  const record = {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    rolledBy,
    rolledAt,
    sides,
    count,
    rolls,
    total,
    clientIp,
  };

  try {
    const totalRolls = await appendRoll(record);
    res.json({
      message: `${rolledBy} rolled ${count}d${sides}: [${rolls.join(', ')}] = ${total}`,
      ...record,
      totalRolls,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record roll', details: String(err.message || err) });
  }
});

app.get('/api/rolls', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500);
  try {
    const entries = await readLog();
    entries.sort((a, b) => new Date(b.rolledAt).getTime() - new Date(a.rolledAt).getTime());
    const rows = entries.slice(0, limit);
    res.json({ count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rolls', details: String(err.message || err) });
  }
});

async function start() {
  try {
    await containerClient.createIfNotExists();
    app.listen(port, () => {
      console.log(`dice-roll-api listening on ${port}`);
    });
  } catch (err) {
    console.error('Failed to initialize Azure Blob Storage:', err);
    process.exit(1);
  }
}

start();
