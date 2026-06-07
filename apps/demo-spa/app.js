/* SPA controller — renders one question per turn, branches via each step's `when`,
   then shows the generated artifacts and a simulated provisioning run. */

(function () {
  const { STEPS, buildArtifacts, ISOLATION } = window.QDFlow;
  const root = document.getElementById('app');

  const state = {
    answers: {},
    history: [], // visited step ids, for Back
    phase: 'welcome', // welcome | question | summary | deploying | done
    currentId: null,
  };

  // -- step navigation -------------------------------------------------------
  function visibleSteps() {
    return STEPS.filter((s) => (s.when ? s.when(state.answers) : true));
  }

  function firstStep() {
    return visibleSteps()[0];
  }

  function nextStepAfter(id) {
    const steps = visibleSteps();
    const idx = steps.findIndex((s) => s.id === id);
    return steps[idx + 1] || null;
  }

  function progress() {
    const steps = visibleSteps();
    const idx = steps.findIndex((s) => s.id === state.currentId);
    return { idx: Math.max(idx, 0) + 1, total: steps.length };
  }

  // -- rendering -------------------------------------------------------------
  function render() {
    if (state.phase === 'welcome') return renderWelcome();
    if (state.phase === 'question') return renderQuestion();
    if (state.phase === 'summary') return renderSummary();
    if (state.phase === 'deploying') return renderDeploying();
    if (state.phase === 'done') return renderDone();
  }

  function shell(inner) {
    root.innerHTML = `
      <div class="wrap">
        <header class="top">
          <div class="brand"><span class="dot"></span> Query Designer <em>Deployment Flow</em></div>
          <button id="restart" class="link">Restart</button>
        </header>
        ${inner}
      </div>`;
    const r = document.getElementById('restart');
    if (r) r.onclick = restart;
  }

  function renderWelcome() {
    shell(`
      <section class="card hero">
        <h1>Deploy your purchased product</h1>
        <p class="lead">Answer a few questions — one per turn. Your choices select the right
          hosting model and generate the exact deployment parameters.</p>
        <div class="options">
          ${ISOLATION.map(
            (o) => `<div class="opt"><span class="tag">${o.value}</span>${o.label.replace(/^[A-D] — /, '')}</div>`
          ).join('')}
        </div>
        <button class="primary" id="start">Start →</button>
      </section>`);
    document.getElementById('start').onclick = () => {
      const s = firstStep();
      state.phase = 'question';
      state.currentId = s.id;
      render();
    };
  }

  function renderQuestion() {
    const step = visibleSteps().find((s) => s.id === state.currentId);
    if (!step) { goSummary(); return; }
    const { idx, total } = progress();
    const current = state.answers[step.id] ?? step.default ?? '';

    let control = '';
    if (step.type === 'choice') {
      control = `<div class="choices">${step.options
        .map(
          (o) => `<label class="choice ${current === o.value ? 'sel' : ''}">
            <input type="radio" name="ans" value="${o.value}" ${current === o.value ? 'checked' : ''}/>
            <span>${o.label}</span></label>`
        )
        .join('')}</div>`;
    } else {
      control = `<input id="textans" class="text" type="text" value="${escapeHtml(current)}"
        placeholder="${escapeHtml(step.default || '')}" autocomplete="off" />`;
    }

    shell(`
      <section class="card">
        <div class="meta">
          <span class="section">${step.section}</span>
          <span class="count">${idx} / ${total}</span>
        </div>
        <div class="bar"><div class="fill" style="width:${(idx / total) * 100}%"></div></div>
        <h2>${step.prompt}</h2>
        ${step.help ? `<p class="help">${step.help}</p>` : ''}
        ${control}
        <div class="nav">
          <button class="ghost" id="back" ${state.history.length ? '' : 'disabled'}>← Back</button>
          <button class="primary" id="next">Next →</button>
        </div>
      </section>`);

    // wire choice selection
    root.querySelectorAll('input[name="ans"]').forEach((el) => {
      el.onchange = () => {
        state.answers[step.id] = el.value;
        root.querySelectorAll('.choice').forEach((c) => c.classList.remove('sel'));
        el.closest('.choice').classList.add('sel');
      };
    });
    const textEl = document.getElementById('textans');
    if (textEl) {
      textEl.focus();
      textEl.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('next').click(); };
    }

    document.getElementById('back').onclick = () => {
      const prev = state.history.pop();
      if (prev) { state.currentId = prev; render(); }
    };
    document.getElementById('next').onclick = () => {
      const val = textEl ? textEl.value.trim() : state.answers[step.id];
      const resolved = val || step.default || '';
      if (!resolved) { textEl && textEl.classList.add('err'); return; }
      state.answers[step.id] = resolved;
      const next = nextStepAfter(step.id);
      state.history.push(step.id);
      if (next) { state.currentId = next.id; render(); }
      else goSummary();
    };
  }

  function goSummary() {
    state.phase = 'summary';
    render();
  }

  function renderSummary() {
    const { answers, tfvars, envDir, tier, plan } = buildArtifacts(state.answers);
    state._artifacts = { answers, tfvars, envDir, tier };

    shell(`
      <section class="card">
        <div class="meta"><span class="section">Review & deploy</span><span class="count">tier: ${tier}</span></div>
        <h2>Here's what will be provisioned</h2>
        <ul class="plan">${plan.map((p) => `<li>${p}</li>`).join('')}</ul>

        <div class="cols">
          <div>
            <h3>answers.json</h3>
            <pre>${escapeHtml(JSON.stringify(answers, null, 2))}</pre>
          </div>
          <div>
            <h3>generated.auto.tfvars.json</h3>
            <pre>${escapeHtml(JSON.stringify(tfvars, null, 2))}</pre>
          </div>
        </div>

        <p class="cmd">Maps to: <code>terraform -chdir="${envDir}" init &amp;&amp; terraform -chdir="${envDir}" apply</code></p>

        <div class="nav">
          <button class="ghost" id="back">← Back</button>
          <button class="primary" id="deploy">Deploy →</button>
        </div>
      </section>`);

    document.getElementById('back').onclick = () => {
      state.phase = 'question';
      const last = state.history[state.history.length - 1];
      state.currentId = last || firstStep().id;
      render();
    };
    document.getElementById('deploy').onclick = startDeploy;
  }

  // -- simulated provisioning ------------------------------------------------
  const DEPLOY_STEPS = [
    'terraform init',
    'terraform plan',
    'Creating resource group',
    'Provisioning network / VPN (if private)',
    'Deploying metadata store',
    'Deploying Publish API + Designer UI',
    'Configuring endpoint gateway',
    'Wiring data source connection',
    'Preparing designer for first use',
  ];

  function startDeploy() {
    state.phase = 'deploying';
    state._log = [];
    render();
    let i = 0;
    const timer = setInterval(() => {
      if (i < DEPLOY_STEPS.length) {
        state._log.push({ text: DEPLOY_STEPS[i], done: false });
        if (i > 0) state._log[i - 1].done = true;
        i++;
        renderDeploying();
      } else {
        state._log[state._log.length - 1].done = true;
        clearInterval(timer);
        state.phase = 'done';
        render();
      }
    }, 650);
  }

  function renderDeploying() {
    const rows = (state._log || [])
      .map(
        (l) => `<li class="${l.done ? 'ok' : 'run'}"><span class="ic">${l.done ? '✓' : '◌'}</span>${l.text}</li>`
      )
      .join('');
    shell(`
      <section class="card">
        <div class="meta"><span class="section">Provisioning</span><span class="count">${state._artifacts.tier}</span></div>
        <h2>Deploying ${state._artifacts.answers.instanceName}…</h2>
        <ul class="log">${rows}</ul>
      </section>`);
  }

  function renderDone() {
    const a = state._artifacts.answers;
    const exposure = a.endpointExposure;
    const designerUrl = `https://designer-${a.instanceName}.example.net`;
    const endpointBase =
      exposure === 'private'
        ? `https://private-${a.instanceName}.internal (over ${a.dataConnectivity === 'ipsec' ? 'IPSec' : 'VPN'})`
        : `https://api-${a.instanceName}.example.net`;

    shell(`
      <section class="card success">
        <div class="check">✓</div>
        <h1>Designer is ready</h1>
        <p class="lead">Your product instance <strong>${a.instanceName}</strong> is deployed.
          The customer can now open the designer and publish endpoints.</p>
        <div class="links">
          <div><span>Designer URL</span><code>${designerUrl}</code></div>
          <div><span>Endpoint base</span><code>${endpointBase}</code></div>
          <div><span>Isolation</span><code>${a.isolation} (${state._artifacts.tier})</code></div>
        </div>
        <div class="nav">
          <button class="ghost" id="again">Run another flow</button>
          <button class="primary" id="copy">Copy answers.json</button>
        </div>
      </section>`);
    document.getElementById('again').onclick = restart;
    document.getElementById('copy').onclick = () => {
      navigator.clipboard?.writeText(JSON.stringify(a, null, 2));
      const b = document.getElementById('copy');
      b.textContent = 'Copied ✓';
      setTimeout(() => (b.textContent = 'Copy answers.json'), 1500);
    };
  }

  // -- utils -----------------------------------------------------------------
  function restart() {
    state.answers = {};
    state.history = [];
    state._log = [];
    state._artifacts = null;
    state.phase = 'welcome';
    state.currentId = null;
    render();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  render();
})();
