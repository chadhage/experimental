import { useEffect, useState } from 'react'
import { api, type DataConnection, type PublishResult } from './api'

const SOURCE_TYPES = ['sqlserver', 'databricks', 'snowflake', 'sharepoint', 'excelonline']

export function App() {
  const [connections, setConnections] = useState<DataConnection[]>([])
  const [form, setForm] = useState({ name: '', type: 'sqlserver', host: '', connectivity: 'internet', secretRef: '' })
  const [sql, setSql] = useState('SELECT TOP 100 * FROM dbo.Orders')
  const [connectionId, setConnectionId] = useState('')
  const [exposure, setExposure] = useState('public')
  const [result, setResult] = useState<PublishResult | null>(null)
  const [error, setError] = useState('')

  const refresh = () => api.listConnections().then(setConnections).catch((e) => setError(String(e)))
  useEffect(() => { refresh() }, [])

  async function addConnection(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const c = await api.createConnection({ ...form })
      setConnectionId(c.id)
      setForm({ ...form, name: '', host: '' })
      refresh()
    } catch (e) { setError(String(e)) }
  }

  async function publish() {
    setError('')
    try {
      setResult(await api.publish({ name: 'demo-endpoint', connectionId, sql, exposure }))
    } catch (e) { setError(String(e)) }
  }

  return (
    <div className="page">
      <header><h1>Query Designer</h1><span className="badge">sample app</span></header>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <h2>1 · Connect a data source</h2>
        <form className="grid" onSubmit={addConnection}>
          <label>Name<input value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {SOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Host<input value={form.host} required placeholder="sql.contoso.com" onChange={(e) => setForm({ ...form, host: e.target.value })} /></label>
          <label>Connectivity
            <select value={form.connectivity} onChange={(e) => setForm({ ...form, connectivity: e.target.value })}>
              <option>internet</option><option>ipsec</option>
            </select>
          </label>
          <label>Secret ref<input value={form.secretRef} placeholder="kv://contoso/sql" onChange={(e) => setForm({ ...form, secretRef: e.target.value })} /></label>
          <button type="submit">Add connection</button>
        </form>
        <ul className="conn-list">
          {connections.map((c) => (
            <li key={c.id}>
              <input type="radio" name="conn" checked={connectionId === c.id} onChange={() => setConnectionId(c.id)} />
              <strong>{c.name}</strong> · {c.type} · {c.host} · {c.connectivity}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>2 · Design a query</h2>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={5} />
      </section>

      <section className="card">
        <h2>3 · Publish endpoint</h2>
        <label className="inline">Exposure
          <select value={exposure} onChange={(e) => setExposure(e.target.value)}>
            <option>public</option><option>private</option>
          </select>
        </label>
        <button disabled={!connectionId} onClick={publish}>Publish</button>
        {result && (
          <div className="result">
            <p><strong>Endpoint:</strong> <code>{result.url}</code> ({result.exposure})</p>
            <p><strong>Access token:</strong> <code>{result.accessToken}</code></p>
            <p className="hint">Consume with: <code>curl -H "Authorization: Bearer {result.accessToken}" {result.url}</code></p>
          </div>
        )}
      </section>
    </div>
  )
}
