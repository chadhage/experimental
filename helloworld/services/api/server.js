const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { TableClient } = require('@azure/data-tables');

const app = express();
const port = Number(process.env.PORT || 8080);

const tableName = process.env.AZURE_TABLE_NAME || 'invocationlogs';
const connectionString =
  process.env.AZURE_TABLE_CONNECTION_STRING ||
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';
const tableClient = TableClient.fromConnectionString(connectionString, tableName);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

function escapeODataValue(value) {
  return String(value).replaceAll("'", "''");
}

async function countEntities(filter) {
  let count = 0;
  const options = filter ? { queryOptions: { filter } } : {};
  for await (const _entity of tableClient.listEntities(options)) {
    count += 1;
  }
  return count;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

app.get('/health', async (_req, res) => {
  try {
    await tableClient.createTable();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: String(err.message || err) });
  }
});

app.post('/api/hello', async (req, res) => {
  const invokedByRaw = req.body?.invokedBy || req.header('x-invoked-by') || 'anonymous';
  const invokedBy = String(invokedByRaw).trim().slice(0, 200) || 'anonymous';
  const clientIp = getClientIp(req).slice(0, 100);
  const userAgent = String(req.header('user-agent') || 'unknown').slice(0, 2000);
  const invokedAt = new Date().toISOString();
  const partitionKey = invokedBy.toLowerCase();
  const rowKey = `${Date.now()}-${crypto.randomUUID()}`;

  try {
    await tableClient.createEntity({
      partitionKey,
      rowKey,
      invokedBy,
      invokedAt,
      clientIp,
      userAgent,
    });

    const totalInvocations = await countEntities();
    const invocationsByUser = await countEntities(`PartitionKey eq '${escapeODataValue(partitionKey)}'`);

    res.json({
      message: `Hello, ${invokedBy}!`,
      invokedBy,
      invokedAt,
      totalInvocations,
      invocationsByUser,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record invocation', details: String(err.message || err) });
  }
});

app.get('/api/invocations', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500);
  try {
    const entities = [];
    for await (const entity of tableClient.listEntities()) {
      entities.push({
        id: entity.rowKey,
        invokedBy: entity.invokedBy,
        invokedAt: entity.invokedAt,
        clientIp: entity.clientIp,
        userAgent: entity.userAgent,
      });
    }

    entities.sort((a, b) => new Date(b.invokedAt).getTime() - new Date(a.invokedAt).getTime());
    const rows = entities.slice(0, limit);
    res.json({ count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invocations', details: String(err.message || err) });
  }
});

async function start() {
  try {
    await tableClient.createTable();
    app.listen(port, () => {
      console.log(`hello-world-api listening on ${port}`);
    });
  } catch (err) {
    console.error('Failed to initialize Azure Table Storage:', err);
    process.exit(1);
  }
}

start();
