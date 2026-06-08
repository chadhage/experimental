const rollBtn = document.getElementById('rollBtn');
const refreshBtn = document.getElementById('refreshBtn');
const rolledByInput = document.getElementById('rolledBy');
const countInput = document.getElementById('count');
const sidesInput = document.getElementById('sides');
const resultEl = document.getElementById('result');
const rowsEl = document.getElementById('rows');
const API_BASE = 'http://localhost:8081';

async function roll() {
  const rolledBy = (rolledByInput.value || '').trim() || 'anonymous';
  const count = Number(countInput.value || 2);
  const sides = Number(sidesInput.value || 6);

  const response = await fetch(`${API_BASE}/api/roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rolledBy, count, sides }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Roll failed');
  }

  resultEl.textContent = JSON.stringify(payload, null, 2);
  await loadRows();
}

async function loadRows() {
  const response = await fetch(`${API_BASE}/api/rolls?limit=25`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load rows');
  }

  rowsEl.innerHTML = payload.rows
    .map(
      (row) => `
        <tr>
          <td>${row.id}</td>
          <td>${escapeHtml(row.rolledBy)}</td>
          <td>${new Date(row.rolledAt).toISOString()}</td>
          <td>${row.count}d${row.sides}</td>
          <td>${escapeHtml((row.rolls || []).join(', '))}</td>
          <td>${row.total}</td>
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

rollBtn.addEventListener('click', async () => {
  rollBtn.disabled = true;
  try {
    await roll();
  } catch (error) {
    resultEl.textContent = JSON.stringify({ error: String(error.message || error) }, null, 2);
  } finally {
    rollBtn.disabled = false;
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
