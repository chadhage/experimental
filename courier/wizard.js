#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { WORKLOADS } = require('./lib/workloads');
const { CLOUDS } = require('./lib/clouds');
const { signIn } = require('./lib/auth');
const { validateDeployment } = require('./lib/validate');
const { buildCommands, buildPlan, DEFAULT_REPO } = require('./lib/plan');
const { runDeployment } = require('./lib/deploy');
const {
  createInterface,
  promptValue,
  promptChoice,
  promptMultiChoice,
  promptConfirm,
} = require('./lib/prompt');

const TOTAL_STEPS = 12;

function banner() {
  console.log('');
  console.log('==================================================');
  console.log('  Courier — guided deployment for sample workloads');
  console.log('==================================================');
  console.log('Deploy a workload from GitHub to Azure, AWS, or GCP.');
  console.log('Inputs are collected and validated, then Courier runs a');
  console.log('simulated deployment and verifies it. Nothing real is created.');
}

function stepHeader(number, title) {
  console.log(`\n— Step ${number} of ${TOTAL_STEPS} — ${title}`);
}

async function run() {
  banner();
  const rl = createInterface();

  try {
    // Step 1 — choose the workload to deploy.
    stepHeader(1, 'Select workload to deploy');
    const workloadChoice = await promptChoice(
      rl,
      'Which workload do you want to deploy?',
      WORKLOADS.map((w) => ({ key: w.key, title: w.title, description: w.description }))
    );
    const workloadKey = workloadChoice.key;

    // Step 2 — choose the target cloud.
    stepHeader(2, 'Select cloud to deploy to');
    const cloudChoice = await promptChoice(
      rl,
      'Which cloud do you want to deploy to?',
      CLOUDS.map((c) => ({ key: c.key, title: c.title, description: c.description }))
    );
    const cloud = CLOUDS.find((c) => c.key === cloudChoice.key);

    // Step 3 — simulated single sign-on.
    stepHeader(3, 'Sign in to cloud using SSO');
    const session = signIn(cloud.key);
    console.log(`Opening ${session.provider} sign-in (simulated — no real credentials used)…`);
    console.log(`Signed in as ${session.identity.name} <${session.identity.email}>.`);

    // Step 4 — choose the subscription/account/project.
    stepHeader(4, `Select ${cloud.terms.subscription.toLowerCase()} to deploy to`);
    const subscriptionChoice = await promptChoice(
      rl,
      `Which ${cloud.terms.subscription.toLowerCase()} do you want to deploy to?`,
      session.subscriptions.map((s) => ({ key: s.id, title: s.name, description: s.id }))
    );
    const subscriptionId = subscriptionChoice.key;

    // Step 5 — choose the region.
    stepHeader(5, `Select ${cloud.terms.region.toLowerCase()} to deploy to`);
    const regionChoice = await promptChoice(
      rl,
      `Which ${cloud.terms.region.toLowerCase()} do you want to deploy to?`,
      cloud.regions.map((r) => ({
        key: r.id,
        title: r.name,
        description: `${r.id} · ${r.zones.length} ${cloud.terms.zone.toLowerCase()}s`,
      }))
    );
    const region = cloud.regions.find((r) => r.id === regionChoice.key);

    // Step 6 — choose one or more zones.
    stepHeader(6, `Select ${cloud.terms.zone.toLowerCase()}s to deploy to`);
    const zoneChoices = await promptMultiChoice(
      rl,
      `Which ${cloud.terms.zone.toLowerCase()}s do you want to deploy to?`,
      region.zones.map((z) => ({ key: z, title: z }))
    );
    const zones = zoneChoices.map((z) => z.key);

    // Step 7 — instance name.
    stepHeader(7, 'Specify instance name');
    const instanceName = await promptValue(rl, {
      label: 'Instance name',
      default: `${workloadKey}-demo`,
      pattern: /^[a-z][a-z0-9-]{2,38}[a-z0-9]$/,
      hint: '4-40 chars: lowercase letters, digits, hyphens; start with a letter.',
    });

    // Step 8 — instance owner name and email.
    stepHeader(8, 'Specify the instance owner name and email');
    const ownerName = await promptValue(rl, {
      label: 'Owner name',
      default: session.identity.name,
      pattern: /\S/,
      hint: 'Enter the owner display name.',
    });
    const ownerEmail = await promptValue(rl, {
      label: 'Owner email',
      default: session.identity.email,
      pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
      hint: 'Enter a valid email address.',
    });

    // Validate the full selection and resolve the answer objects.
    const { errors, answers } = validateDeployment({
      workload: workloadKey,
      cloud: cloud.key,
      subscriptionId,
      regionId: region.id,
      zones,
      instanceName,
      ownerName,
      ownerEmail,
    });

    if (errors.length) {
      console.log('\nThe selection has problems:');
      errors.forEach((error) => console.log(`  ! ${error}`));
      console.log('Please run the wizard again.');
      return;
    }

    answers.source = { repoUrl: DEFAULT_REPO, branch: 'main' };

    // Step 9 — confirmation of all inputs.
    stepHeader(9, 'Display a confirmation of all inputs');
    printSummary(answers);

    // Step 10 — press deploy to proceed.
    stepHeader(10, 'Deploy');
    const proceed = await promptConfirm(rl, `Deploy ${answers.instanceName} now?`, true);
    if (!proceed) {
      console.log('Cancelled. Nothing was deployed.');
      return;
    }

    const deployment = runDeployment(answers);

    // Step 11 — perform deployment checks.
    stepHeader(11, 'Perform deployment checks');
    console.log(`Simulating deployment to ${deployment.cloud.title}…`);
    deployment.resources.forEach((r) => {
      console.log(`  ✓ ${r.type}: ${r.name} [${r.status}]`);
    });
    console.log('Running verification checks…');
    deployment.checks.forEach((c) => {
      console.log(`  ${c.status === 'passed' ? '✓' : '✗'} ${c.name} — ${c.detail}`);
    });

    // Step 12 — summary + empirical evidence.
    stepHeader(12, 'Deployment summary');
    printDeploymentSummary(deployment);

    const plan = buildPlan(answers);
    const commands = buildCommands(answers);

    const outDir = path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${answers.instanceName}-${cloud.key}-${stamp}`;
    const planPath = path.join(outDir, `${baseName}.plan.json`);
    const scriptPath = path.join(outDir, `${baseName}.deploy.sh`);
    const evidencePath = path.join(outDir, `${baseName}.evidence.txt`);

    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    fs.writeFileSync(scriptPath, `#!/usr/bin/env bash\nset -euo pipefail\n\n${commands.join('\n')}\n`, 'utf8');
    fs.writeFileSync(evidencePath, `${buildEvidenceText(deployment)}\n`, 'utf8');

    console.log(`\nSaved plan:     ${path.relative(process.cwd(), planPath)}`);
    console.log(`Saved script:   ${path.relative(process.cwd(), scriptPath)}`);
    console.log(`Saved evidence: ${path.relative(process.cwd(), evidencePath)}`);
    console.log('\nThis deployment and its evidence are simulated for the demo.');
  } finally {
    rl.close();
  }
}

function printSummary(answers) {
  const { cloud } = answers;
  console.log('Review your selections');
  console.log('----------------------');
  console.log(`Workload                : ${answers.workload.title} (${answers.workload.path})`);
  console.log(`Cloud                   : ${cloud.title}`);
  console.log(`${cloud.terms.subscription.padEnd(24)}: ${answers.subscription.name} (${answers.subscription.id})`);
  console.log(`${cloud.terms.region.padEnd(24)}: ${answers.region.name} (${answers.region.id})`);
  console.log(`${`${cloud.terms.zone}s`.padEnd(24)}: ${answers.zones.join(', ')}`);
  console.log(`Instance name           : ${answers.instanceName}`);
  console.log(`Owner                   : ${answers.owner.name} <${answers.owner.email}>`);
}

function printDeploymentSummary(deployment) {
  const { confidence, endpoint } = deployment;
  console.log('What was deployed');
  console.log('-----------------');
  deployment.resources.forEach((r) => {
    console.log(`  • ${r.type}: ${r.name} [${r.status}] — ${r.detail}`);
  });
  console.log(`  Endpoint: ${endpoint.url}`);
  console.log('\nWhat was verified');
  console.log('-----------------');
  deployment.checks.forEach((c) => {
    console.log(`  [${c.status.toUpperCase()}] ${c.name}`);
    console.log(`        evidence: ${c.evidence.label}`);
  });
  console.log(`\nConfidence: ${confidence.level.toUpperCase()} — ${confidence.summary}`);
}

/**
 * Render the full empirical-evidence bundle for saving to disk.
 */
function buildEvidenceText(d) {
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

run().catch((err) => {
  console.error(`\nWizard failed: ${err.message || err}`);
  process.exit(1);
});
