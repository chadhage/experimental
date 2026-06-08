const invokeBtn = document.getElementById('invokeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const invokedByInput = document.getElementById('invokedBy');
const resultEl = document.getElementById('result');
const rowsEl = document.getElementById('rows');
const API_BASE = 'http://localhost:8080';

async function invoke() {
  const invokedBy = (invokedByInput.value || '').trim() || 'anonymous';

  const response = await fetch(`${API_BASE}/api/hello`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invokedBy }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Invocation failed');
  }

  resultEl.textContent = JSON.stringify(payload, null, 2);
  await loadRows();
}

async function loadRows() {
  const response = await fetch(`${API_BASE}/api/invocations?limit=25`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load rows');
  }

  rowsEl.innerHTML = payload.rows
    .map(
      (row) => `
        <tr>
          <td>${row.id}</td>
          <td>${escapeHtml(row.invokedBy)}</td>
          <td>${new Date(row.invokedAt).toISOString()}</td>
          <td>${escapeHtml(row.clientIp)}</td>
        </tr>
      `
    )
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

invokeBtn.addEventListener('click', async () => {
  invokeBtn.disabled = true;
  try {
    await invoke();
  } catch (error) {
    resultEl.textContent = JSON.stringify({ error: String(error.message || error) }, null, 2);
  } finally {
    invokeBtn.disabled = false;
  }
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  try {
    await loadRows();
  } catch (error) {
    resultEl.textContent = JSON.stringify({ error: String(error.message || error) }, null, 2);
  } finally {
    refreshBtn.disabled = false;
  }
});

loadRows().catch((error) => {
  resultEl.textContent = JSON.stringify({ error: String(error.message || error) }, null, 2);
});
