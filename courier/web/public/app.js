'use strict';

const state = {
  options: null,
  stepIndex: 0,
  workloadKey: null,
  cloudKey: null,
  signin: null, // { provider, identity, subscriptions, subscriptionTerm }
  subscriptionId: null,
  regionId: null,
  zones: new Set(),
  instanceName: '',
  ownerName: '',
  ownerEmail: '',
  deployment: null, // result of POST /api/deploy
};

const dom = {
  progress: document.getElementById('progress'),
  stepNum: document.getElementById('stepNum'),
  stepTitle: document.getElementById('stepTitle'),
  stepBody: document.getElementById('stepBody'),
  stepError: document.getElementById('stepError'),
  backBtn: document.getElementById('backBtn'),
  nextBtn: document.getElementById('nextBtn'),
  status: document.getElementById('status'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cloud() {
  return state.options.clouds.find((c) => c.key === state.cloudKey) || null;
}
function region() {
  const c = cloud();
  return c ? c.regions.find((r) => r.id === state.regionId) || null : null;
}
function terms() {
  return cloud()?.terms || { subscription: 'Subscription', region: 'Region', zone: 'Zone' };
}

/* ----------------------------- Step definitions ---------------------------- */

const steps = [
  {
    title: 'Select workload to deploy',
    render: renderWorkload,
    complete: () => Boolean(state.workloadKey),
  },
  {
    title: 'Select cloud to deploy to',
    render: renderCloud,
    complete: () => Boolean(state.cloudKey),
  },
  {
    title: 'Sign in to your cloud',
    render: renderSignin,
    complete: () => Boolean(state.signin),
  },
  {
    title: () => `Select ${terms().subscription.toLowerCase()}`,
    render: renderSubscription,
    complete: () => Boolean(state.subscriptionId),
  },
  {
    title: () => `Select ${terms().region.toLowerCase()}`,
    render: renderRegion,
    complete: () => Boolean(state.regionId),
  },
  {
    title: () => `Select ${terms().zone.toLowerCase()}s`,
    render: renderZones,
    complete: () => state.zones.size > 0,
  },
  {
    title: 'Name your instance',
    render: renderInstanceName,
    complete: () => /^[a-z][a-z0-9-]{2,38}[a-z0-9]$/.test(state.instanceName),
  },
  {
    title: 'Instance owner',
    render: renderOwner,
    complete: () =>
      state.ownerName.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.ownerEmail),
  },
  {
    title: 'Review and confirm',
    render: renderConfirm,
    complete: () => true,
  },
  {
    title: 'Deploy',
    render: renderDeployGate,
    complete: () => true,
    nextLabel: 'Deploy',
    onNext: handleDeploy,
  },
  {
    title: 'Deploying and verifying',
    render: renderDeploying,
    complete: () => true,
    terminal: true,
  },
  {
    title: 'Deployment summary',
    render: renderSummary,
    complete: () => true,
    terminal: true,
  },
];

/* ------------------------------- Renderers --------------------------------- */

function renderWorkload(body) {
  body.innerHTML = '<div class="card-grid" id="cards"></div>';
  renderCards(body.querySelector('#cards'), state.options.workloads, state.workloadKey, (key) => {
    state.workloadKey = key;
    if (!state.instanceName) {
      state.instanceName = `${key}-demo`;
    }
    refresh();
  });
}

function renderCloud(body) {
  body.innerHTML = '<div class="card-grid" id="cards"></div>';
  renderCards(body.querySelector('#cards'), state.options.clouds, state.cloudKey, (key) => {
    if (state.cloudKey !== key) {
      // Cloud changed — reset everything downstream.
      state.cloudKey = key;
      state.signin = null;
      state.subscriptionId = null;
      state.regionId = null;
      state.zones = new Set();
    }
    refresh();
  });
}

function renderSignin(body) {
  const c = cloud();
  if (state.signin) {
    const id = state.signin.identity;
    body.innerHTML = `
      <div class="signed-in">
        <div class="badge ok">Signed in (simulated)</div>
        <p><strong>${escapeHtml(id.name)}</strong> &lt;${escapeHtml(id.email)}&gt;</p>
        <p class="muted">Provider: ${escapeHtml(state.signin.provider)}</p>
        <button type="button" class="ghost" id="signoutBtn">Sign out</button>
      </div>`;
    body.querySelector('#signoutBtn').addEventListener('click', () => {
      state.signin = null;
      state.subscriptionId = null;
      refresh();
    });
    return;
  }

  body.innerHTML = `
    <p class="muted">Courier never stores cloud credentials. This is a
      <strong>simulated</strong> single sign-on for the demo and does not contact ${escapeHtml(c.title)}.</p>
    <button type="button" id="signinBtn">Sign in with ${escapeHtml(c.title)} SSO</button>`;
  const btn = body.querySelector('#signinBtn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Opening SSO…';
    try {
      const response = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud: state.cloudKey }),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error((result.errors || ['Sign-in failed']).join(', '));
      }
      state.signin = result;
      // Prefill the owner from the signed-in identity.
      if (!state.ownerName) state.ownerName = result.identity.name;
      if (!state.ownerEmail) state.ownerEmail = result.identity.email;
      refresh();
    } catch (error) {
      dom.stepError.textContent = String(error.message || error);
      btn.disabled = false;
      btn.textContent = `Sign in with ${c.title} SSO`;
    }
  });
}

function renderSubscription(body) {
  const subs = state.signin.subscriptions;
  body.innerHTML = `<div class="radio-list">${subs
    .map(
      (s) => `
      <label class="radio-row ${s.id === state.subscriptionId ? 'selected' : ''}">
        <input type="radio" name="sub" value="${escapeHtml(s.id)}" ${s.id === state.subscriptionId ? 'checked' : ''} />
        <span class="radio-main">${escapeHtml(s.name)}</span>
        <span class="radio-sub">${escapeHtml(s.id)}</span>
      </label>`
    )
    .join('')}</div>`;
  body.querySelectorAll('input[name="sub"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.subscriptionId = input.value;
      refresh();
    });
  });
}

function renderRegion(body) {
  const regions = cloud().regions;
  body.innerHTML = `<div class="radio-list">${regions
    .map(
      (r) => `
      <label class="radio-row ${r.id === state.regionId ? 'selected' : ''}">
        <input type="radio" name="region" value="${escapeHtml(r.id)}" ${r.id === state.regionId ? 'checked' : ''} />
        <span class="radio-main">${escapeHtml(r.name)}</span>
        <span class="radio-sub">${escapeHtml(r.id)} · ${r.zones.length} ${escapeHtml(terms().zone.toLowerCase())}s</span>
      </label>`
    )
    .join('')}</div>`;
  body.querySelectorAll('input[name="region"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (state.regionId !== input.value) {
        state.regionId = input.value;
        state.zones = new Set(); // zones depend on the region
      }
      refresh();
    });
  });
}

function renderZones(body) {
  const r = region();
  if (!r) {
    body.innerHTML = '<p class="muted">Select a region first.</p>';
    return;
  }
  body.innerHTML = `
    <p class="muted">Choose one or more ${escapeHtml(terms().zone.toLowerCase())}s in ${escapeHtml(r.name)}.</p>
    <div class="chip-grid">${r.zones
      .map(
        (z) => `
        <label class="chip ${state.zones.has(z) ? 'selected' : ''}">
          <input type="checkbox" value="${escapeHtml(z)}" ${state.zones.has(z) ? 'checked' : ''} />
          <span>${escapeHtml(z)}</span>
        </label>`
      )
      .join('')}</div>`;
  body.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) state.zones.add(input.value);
      else state.zones.delete(input.value);
      refresh();
    });
  });
}

function renderInstanceName(body) {
  body.innerHTML = `
    <div class="field">
      <label for="instanceName">Instance name</label>
      <input id="instanceName" type="text" value="${escapeHtml(state.instanceName)}"
        placeholder="e.g. helloworld-demo" />
      <small class="muted">4-40 chars: lowercase letters, digits, hyphens; start with a letter.</small>
    </div>`;
  const input = body.querySelector('#instanceName');
  input.addEventListener('input', () => {
    state.instanceName = input.value.trim();
    refreshNavOnly();
  });
}

function renderOwner(body) {
  body.innerHTML = `
    <div class="fields">
      <div class="field">
        <label for="ownerName">Owner name</label>
        <input id="ownerName" type="text" value="${escapeHtml(state.ownerName)}" placeholder="Full name" />
      </div>
      <div class="field">
        <label for="ownerEmail">Owner email</label>
        <input id="ownerEmail" type="email" value="${escapeHtml(state.ownerEmail)}" placeholder="name@example.com" />
      </div>
    </div>`;
  body.querySelector('#ownerName').addEventListener('input', (e) => {
    state.ownerName = e.target.value;
    refreshNavOnly();
  });
  body.querySelector('#ownerEmail').addEventListener('input', (e) => {
    state.ownerEmail = e.target.value.trim();
    refreshNavOnly();
  });
}

function renderConfirm(body) {
  const c = cloud();
  const w = state.options.workloads.find((x) => x.key === state.workloadKey);
  const sub = state.signin.subscriptions.find((s) => s.id === state.subscriptionId);
  const r = region();
  const rows = [
    ['Workload', w.title],
    ['Cloud', c.title],
    ['Signed in as', `${state.signin.identity.name} <${state.signin.identity.email}>`],
    [terms().subscription, `${sub.name} (${sub.id})`],
    [terms().region, `${r.name} (${r.id})`],
    [`${terms().zone}s`, [...state.zones].join(', ')],
    ['Instance name', state.instanceName],
    ['Owner', `${state.ownerName} <${state.ownerEmail}>`],
  ];
  body.innerHTML = `
    <table class="summary">${rows
      .map(
        ([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`
      )
      .join('')}</table>
    <p class="muted">Review the selections above, then click <strong>Next</strong> to continue to the
      deploy step.</p>`;
}

function renderDeployGate(body) {
  const c = cloud();
  body.innerHTML = `
    <div class="badge">Ready to deploy</div>
    <p>Courier will deploy <strong>${escapeHtml(state.instanceName)}</strong> to
      <strong>${escapeHtml(c.title)}</strong> in <strong>${escapeHtml(region().name)}</strong>.</p>
    <p class="muted">Press <strong>Deploy</strong> to start the (simulated) deployment. Courier never
      contacts a real cloud — it simulates provisioning and then runs verification checks.</p>`;
}

function renderDeploying(body) {
  const d = state.deployment;
  body.innerHTML = `
    <div class="badge">Deploying (simulated)</div>
    <p class="muted">Simulating deployment to ${escapeHtml(d.cloud.title)} and running verification
      checks. No real resources are created.</p>
    <h3>Provisioning ${escapeHtml(d.cloud.title)} resources</h3>
    <ul class="status-list" id="provList"></ul>
    <h3>Verification checks</h3>
    <ul class="status-list" id="checkList"></ul>
    <div class="result-actions" id="deployDone" hidden>
      <button type="button" id="summaryBtn">View deployment summary &rarr;</button>
    </div>`;

  const provList = body.querySelector('#provList');
  const checkList = body.querySelector('#checkList');
  const done = body.querySelector('#deployDone');
  const summaryIndex = steps.length - 1;

  let delay = 250;
  d.resources.forEach((r) => {
    setTimeout(() => {
      if (!provList.isConnected) return;
      const li = document.createElement('li');
      li.className = 'status-row done';
      li.innerHTML =
        `<span class="tick ok">\u2713</span>` +
        `<span class="status-main">${escapeHtml(r.type)}: <strong>${escapeHtml(r.name)}</strong></span>` +
        `<span class="status-sub">${escapeHtml(r.status)} \u00b7 ${escapeHtml(r.detail)}</span>`;
      provList.appendChild(li);
    }, delay);
    delay += 350;
  });

  d.checks.forEach((c) => {
    setTimeout(() => {
      if (!checkList.isConnected) return;
      const li = document.createElement('li');
      li.className = 'status-row done';
      li.innerHTML =
        `<span class="tick ok">\u2713</span>` +
        `<span class="status-main">${escapeHtml(c.name)}</span>` +
        `<span class="status-sub">${escapeHtml(c.detail)}</span>`;
      checkList.appendChild(li);
    }, delay);
    delay += 450;
  });

  setTimeout(() => {
    if (!done.isConnected) return;
    done.hidden = false;
    done.querySelector('#summaryBtn').addEventListener('click', () => showStep(summaryIndex));
  }, delay + 200);
}

function buildEvidenceBundle(d) {
  const lines = [
    'Courier deployment evidence bundle (SIMULATED — no real cloud was contacted)',
    `Instance : ${d.instance.name}`,
    `Cloud    : ${d.cloud.title} (${d.cloud.cli})`,
    `Endpoint : ${d.endpoint.url}`,
    `Started  : ${d.startedAt}`,
    `Finished : ${d.finishedAt}`,
    `Confidence: ${d.confidence.level} — ${d.confidence.summary}`,
    '',
    '=== Resources deployed ===',
    ...d.resources.map((r) => `- ${r.type}: ${r.name} [${r.status}] ${r.id}`),
    '',
    '=== Verification checks ===',
  ];
  d.checks.forEach((c) => {
    lines.push(
      '',
      `[${c.status.toUpperCase()}] ${c.name}`,
      `  ${c.detail}`,
      `  Evidence — ${c.evidence.label}:`,
      ...c.evidence.content.split('\n').map((l) => `    ${l}`)
    );
  });
  return lines.join('\n');
}

function renderSummary(body) {
  const d = state.deployment;
  const conf = d.confidence;
  const t = d.target;

  const deployedRows = [
    ['Workload', d.workload.title],
    ['Cloud', d.cloud.title],
    [t.subscriptionTerm, `${t.subscription.name} (${t.subscription.id})`],
    ['Region', `${t.region.name} (${t.region.id})`],
    ['Zones', t.zones.join(', ')],
    ['Instance', d.instance.name],
    ['Owner', `${d.instance.owner.name} <${d.instance.owner.email}>`],
    ['Endpoint', `<a href="${escapeHtml(d.endpoint.url)}" target="_blank" rel="noopener">${escapeHtml(d.endpoint.url)}</a>`],
  ];

  const resourceRows = d.resources
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.type)}</td>
        <td><code>${escapeHtml(r.name)}</code></td>
        <td><span class="badge ok">${escapeHtml(r.status)}</span></td>
        <td class="muted">${escapeHtml(r.detail)}</td>
      </tr>`
    )
    .join('');

  const checkItems = d.checks
    .map(
      (c) => `<li class="evidence-item">
        <div class="evidence-head">
          <span class="badge ${c.status === 'passed' ? 'ok' : 'bad'}">${c.status === 'passed' ? 'PASS' : 'FAIL'}</span>
          <strong>${escapeHtml(c.name)}</strong>
        </div>
        <p class="muted">${escapeHtml(c.detail)}</p>
        <details>
          <summary>View evidence &mdash; ${escapeHtml(c.evidence.label)}</summary>
          <pre>${escapeHtml(c.evidence.content)}</pre>
        </details>
      </li>`
    )
    .join('');

  body.innerHTML = `
    <div class="badge ok">Deployment verified &mdash; confidence: ${escapeHtml(conf.level)}</div>
    <p>${escapeHtml(conf.summary)} The simulated deployment finished in
      ${(d.durationMs / 1000).toFixed(1)}s.</p>

    <h3>What was deployed</h3>
    <table class="summary">${deployedRows
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${v}</td></tr>`)
      .join('')}</table>
    <table class="resource-table">
      <thead><tr><th>Resource</th><th>Name</th><th>Status</th><th>Details</th></tr></thead>
      <tbody>${resourceRows}</tbody>
    </table>

    <h3>What was verified &mdash; with empirical evidence</h3>
    <p class="muted">Each check links to the underlying evidence (command output, HTTP traces, or
      logs) that supports the ${escapeHtml(conf.level)} confidence rating.</p>
    <ul class="evidence-list">${checkItems}</ul>

    <div class="result-actions">
      <button type="button" id="downloadEvidence">Download evidence bundle</button>
      <button type="button" id="restartBtn" class="ghost">Start over</button>
    </div>
    <p class="muted">This deployment and its evidence are simulated for the demo.</p>`;

  body.querySelector('#downloadEvidence').addEventListener('click', () => {
    const blob = new Blob([buildEvidenceBundle(d)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${d.instance.name}-${d.cloud.key}.evidence.txt`;
    link.click();
    URL.revokeObjectURL(url);
  });
  body.querySelector('#restartBtn').addEventListener('click', restart);
}

/* ------------------------------- Shared UI --------------------------------- */

function renderCards(container, items, selectedKey, onSelect) {
  container.innerHTML = items
    .map(
      (item) => `
      <button type="button" class="card ${item.key === selectedKey ? 'selected' : ''}" data-key="${item.key}">
        <span class="card-title">${escapeHtml(item.title)}</span>
        <span class="card-desc">${escapeHtml(item.description || '')}</span>
      </button>`
    )
    .join('');
  container.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => onSelect(card.dataset.key));
  });
}

function renderProgress() {
  dom.progress.innerHTML = steps
    .map((step, index) => {
      const cls = index === state.stepIndex ? 'active' : index < state.stepIndex ? 'done' : '';
      return `<li class="${cls}"><span class="dot">${index + 1}</span></li>`;
    })
    .join('');
}

function titleOf(step) {
  return typeof step.title === 'function' ? step.title() : step.title;
}

/* ------------------------------ Navigation --------------------------------- */

function refresh() {
  showStep(state.stepIndex);
}

function refreshNavOnly() {
  const step = steps[state.stepIndex];
  dom.nextBtn.disabled = !step.complete();
  dom.stepError.textContent = '';
}

function showStep(index) {
  state.stepIndex = index;
  const step = steps[index];
  dom.stepNum.textContent = index + 1;
  dom.stepTitle.textContent = titleOf(step);
  dom.stepError.textContent = '';
  dom.status.textContent = '';
  dom.stepBody.innerHTML = '';
  step.render(dom.stepBody);

  renderProgress();

  dom.backBtn.style.visibility = index === 0 || step.terminal ? 'hidden' : 'visible';
  if (step.terminal) {
    dom.nextBtn.style.visibility = 'hidden';
  } else {
    dom.nextBtn.style.visibility = 'visible';
    dom.nextBtn.textContent = step.nextLabel || 'Next';
    dom.nextBtn.disabled = !step.complete();
  }
}

async function goNext() {
  const step = steps[state.stepIndex];
  if (!step.complete()) {
    dom.stepError.textContent = 'Please complete this step to continue.';
    return;
  }
  if (step.onNext) {
    await step.onNext();
    return;
  }
  showStep(state.stepIndex + 1);
}

function goBack() {
  if (state.stepIndex > 0) {
    showStep(state.stepIndex - 1);
  }
}

async function handleDeploy() {
  dom.nextBtn.disabled = true;
  dom.status.textContent = 'Starting deployment\u2026';
  const payload = {
    workload: state.workloadKey,
    cloud: state.cloudKey,
    subscriptionId: state.subscriptionId,
    regionId: state.regionId,
    zones: [...state.zones],
    instanceName: state.instanceName,
    ownerName: state.ownerName,
    ownerEmail: state.ownerEmail,
  };
  try {
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.ok) {
      dom.stepError.textContent = (result.errors || ['Deployment failed.']).join('  \u2022  ');
      dom.nextBtn.disabled = false;
      dom.status.textContent = '';
      return;
    }
    state.deployment = result.deployment;
    showStep(state.stepIndex + 1);
  } catch (error) {
    dom.stepError.textContent = String(error.message || error);
    dom.nextBtn.disabled = false;
    dom.status.textContent = '';
  }
}

function restart() {
  state.stepIndex = 0;
  state.workloadKey = null;
  state.cloudKey = null;
  state.signin = null;
  state.subscriptionId = null;
  state.regionId = null;
  state.zones = new Set();
  state.instanceName = '';
  state.ownerName = '';
  state.ownerEmail = '';
  state.deployment = null;
  showStep(0);
}

dom.nextBtn.addEventListener('click', goNext);
dom.backBtn.addEventListener('click', goBack);

async function init() {
  const response = await fetch('/api/options');
  state.options = await response.json();
  showStep(0);
}

init().catch((error) => {
  dom.stepError.textContent = `Failed to load options: ${error.message || error}`;
});
