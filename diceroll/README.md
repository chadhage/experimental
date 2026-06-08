# Dice Roll Microservice

A small sample microservice with a UI, an API, and a JSON log file persisted to Azure Blob Storage.

## Architecture

- UI (`diceroll/services/ui`): static web app
- API (`diceroll/services/api`): Node.js + Express + Azure Blob Storage client
- Storage: a single JSON log blob (`rolls.json`) in a Blob container (or local Azurite if you run it yourself)

## Quick start

```bash
cd diceroll/services/api
npm install
npm start
```

The API listens on port `8081` by default.

In another terminal, serve the UI from `diceroll/services/ui` on port 5174, for example:

```bash
cd diceroll/services/ui
npx serve -l 5174
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8081` | API listen port |
| `AZURE_BLOB_CONNECTION_STRING` | Azurite local emulator | Blob storage connection string |
| `AZURE_BLOB_CONTAINER` | `dicerolls` | Container name |
| `AZURE_BLOB_LOG_NAME` | `rolls.json` | JSON log blob name |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

## API contract

### `POST /api/roll`

Request body (all optional):

```json
{ "rolledBy": "Ada", "count": 2, "sides": 6 }
```

Response:

```json
{
  "message": "Ada rolled 2d6: [3, 5] = 8",
  "id": "1717800000000-<uuid>",
  "rolledBy": "Ada",
  "rolledAt": "2026-06-08T00:00:00.000Z",
  "sides": 6,
  "count": 2,
  "rolls": [3, 5],
  "total": 8,
  "clientIp": "127.0.0.1",
  "totalRolls": 1
}
```

### `GET /api/rolls?limit=N`

Returns the most recent rolls (newest first) read from the JSON log blob.

### `GET /health`

Ensures the Blob container exists and returns `{ "status": "ok" }`.
