const API = '/api'
const TOKEN = 'dev-token' // designer control-plane token; replace with OAuth in production

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export interface DataConnection {
  id: string
  name: string
  type: string
  host: string
  connectivity: string
  secretRef: string
}

export interface PublishResult {
  id: string
  name: string
  exposure: string
  url: string
  accessToken: string
}

export const api = {
  listConnections: () => call<DataConnection[]>('/connections'),
  createConnection: (c: Omit<DataConnection, 'id'>) =>
    call<DataConnection>('/connections', { method: 'POST', body: JSON.stringify(c) }),
  publish: (p: { name: string; connectionId: string; sql: string; exposure: string }) =>
    call<PublishResult>('/publish', { method: 'POST', body: JSON.stringify(p) }),
}
