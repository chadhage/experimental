# Hello World Microservice Sample

This repository contains a complete sample microservice system with:

- UI: browser app for invoking the service and viewing log history
- API layer: HTTP service for hello responses and log retrieval
- Backend: Azure Table Storage data store that records every invocation timestamp and caller identity

## Architecture

- UI (`helloworld/services/ui`): static web app
- API (`helloworld/services/api`): Node.js + Express + Azure Table Storage client
- Storage: Azure Table Storage account (or local Azurite if you run it yourself)

## Features

- Invoke endpoint with caller name (`invokedBy`)
- Persist every invocation in Azure Table Storage (`invocationlogs` table)
- Return current totals per caller and globally
- List recent invocations in the UI and via API

## Quick start

```bash
cd helloworld/services/api
npm install
npm start
```

In another terminal, serve the UI from `helloworld/services/ui` on port 5173, for example:

```bash
cd helloworld/services/ui
npx serve -l 5173
```

Endpoints:

- UI: `http://localhost:5173`
- API health: `http://localhost:8080/health`
- API hello: `POST http://localhost:8080/api/hello`
- API logs: `GET http://localhost:8080/api/invocations`
- UI static host: `http://localhost:5173`

## Example API calls

```bash
curl -X POST http://localhost:8080/api/hello \
  -H "Content-Type: application/json" \
  -d '{"invokedBy":"Chad"}'
```

```bash
curl http://localhost:8080/api/invocations
```

## API contract

### `POST /api/hello`

Request body:

```json
{
  "invokedBy": "string"
}
```

Response shape:

```json
{
  "message": "Hello, Chad!",
  "invokedBy": "Chad",
  "invokedAt": "2026-06-08T00:00:00.000Z",
  "totalInvocations": 42,
  "invocationsByUser": 7
}
```

### `GET /api/invocations?limit=50`

Returns most recent invocation rows.
