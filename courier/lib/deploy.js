'use strict';

const crypto = require('crypto');

/**
 * Simulated deployment + verification.
 *
 * Courier never contacts a real cloud. This module fakes a deployment so the
 * guided flow can show the final three steps end-to-end:
 *   10. press Deploy,
 *   11. run deployment checks,
 *   12. summarize what was deployed and verified, with the empirical evidence
 *       (command output / HTTP traces / JSON) that backs each check.
 *
 * Everything returned here is illustrative sample data clearly labelled as
 * simulated. No resources are created and no network calls are made.
 */

function hex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function isoAt(base, offsetMs) {
  return new Date(base.getTime() + offsetMs).toISOString();
}

/**
 * Build the set of "deployed" resources for a cloud.
 * @returns {{ resources: object[], endpoint: object }}
 */
function provisionResources(answers, startedAt) {
  const { cloud, region, zones, instanceName } = answers;
  const z = zones.join(', ');

  if (cloud.key === 'azure') {
    const rg = `${instanceName}-rg`;
    const plan = `${instanceName}-plan`;
    const host = `${instanceName}.azurewebsites.net`;
    return {
      endpoint: { url: `https://${host}`, healthUrl: `https://${host}/healthz`, host },
      resources: [
        {
          type: 'Resource group',
          name: rg,
          id: `/subscriptions/${answers.subscription.id}/resourceGroups/${rg}`,
          status: 'Succeeded',
          detail: `Location ${region.id}`,
        },
        {
          type: 'App Service plan',
          name: plan,
          id: `/subscriptions/${answers.subscription.id}/resourceGroups/${rg}/providers/Microsoft.Web/serverfarms/${plan}`,
          status: 'Ready',
          detail: `P1v3 · zone-redundant · ${zones.length} workers · zones ${z}`,
        },
        {
          type: 'Web app',
          name: instanceName,
          id: `/subscriptions/${answers.subscription.id}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${instanceName}`,
          status: 'Running',
          detail: `https://${host}`,
        },
      ],
    };
  }

  if (cloud.key === 'aws') {
    const host = `${instanceName}.${region.id}.elasticbeanstalk.com`;
    return {
      endpoint: { url: `http://${host}`, healthUrl: `http://${host}/healthz`, host },
      resources: [
        {
          type: 'Elastic Beanstalk application',
          name: instanceName,
          id: `arn:aws:elasticbeanstalk:${region.id}:${answers.subscription.id}:application/${instanceName}`,
          status: 'Available',
          detail: `Account ${answers.subscription.id}`,
        },
        {
          type: 'Environment',
          name: `${instanceName}-env`,
          id: `e-${hex(5)}`,
          status: 'Ready',
          detail: `Health: Green · subnets ${z}`,
        },
        {
          type: 'Load balancer',
          name: `${instanceName}-alb`,
          id: `arn:aws:elasticloadbalancing:${region.id}:${answers.subscription.id}:loadbalancer/app/${instanceName}/${hex(8)}`,
          status: 'active',
          detail: `application · ${zones.length} AZs · ${z}`,
        },
      ],
    };
  }

  // gcp
  const host = `${instanceName}-${hex(4)}-uc.a.run.app`;
  return {
    endpoint: { url: `https://${host}`, healthUrl: `https://${host}/healthz`, host },
    resources: [
      {
        type: 'Cloud Run service',
        name: instanceName,
        id: `projects/${answers.subscription.id}/locations/${region.id}/services/${instanceName}`,
        status: 'Ready',
        detail: `Project ${answers.subscription.id} · region ${region.id}`,
      },
      {
        type: 'Revision',
        name: `${instanceName}-00001-${hex(2)}`,
        id: `projects/${answers.subscription.id}/locations/${region.id}/revisions/${instanceName}-00001`,
        status: 'Active',
        detail: `100% traffic · zones ${z}`,
      },
    ],
  };
}

/**
 * Build the verification checks, each carrying empirical evidence.
 * @returns {object[]} checks
 */
function buildChecks(answers, provisioned, startedAt) {
  const { cloud, workload, region, zones, instanceName, owner, subscription } = answers;
  const { endpoint } = provisioned;
  const requestId = hex(8);
  const latency = rand(38, 140);
  const httpDate = new Date(startedAt.getTime() + rand(9000, 14000)).toUTCString();
  const zoneList = zones.join(', ');

  const checks = [];

  // 1. Provisioning state of the primary resource.
  if (cloud.key === 'azure') {
    checks.push({
      id: 'provisioning',
      name: 'Resources provisioned',
      status: 'passed',
      detail: `Resource group ${instanceName}-rg and web app report Succeeded/Running.`,
      evidence: {
        label: `az resource list --resource-group ${instanceName}-rg`,
        kind: 'json',
        content: JSON.stringify(
          provisioned.resources.map((r) => ({
            name: r.name,
            type: r.type,
            provisioningState: r.status,
          })),
          null,
          2
        ),
      },
    });
  } else if (cloud.key === 'aws') {
    checks.push({
      id: 'provisioning',
      name: 'Environment available',
      status: 'passed',
      detail: `Elastic Beanstalk environment ${instanceName}-env is Ready with Green health.`,
      evidence: {
        label: `aws elasticbeanstalk describe-environments --environment-names ${instanceName}-env`,
        kind: 'json',
        content: JSON.stringify(
          {
            Environments: [
              {
                EnvironmentName: `${instanceName}-env`,
                Status: 'Ready',
                Health: 'Green',
                HealthStatus: 'Ok',
                CNAME: endpoint.host,
              },
            ],
          },
          null,
          2
        ),
      },
    });
  } else {
    checks.push({
      id: 'provisioning',
      name: 'Service ready',
      status: 'passed',
      detail: `Cloud Run service ${instanceName} reports Ready with the latest revision active.`,
      evidence: {
        label: `gcloud run services describe ${instanceName} --region ${region.id}`,
        kind: 'yaml',
        content: [
          'status:',
          '  conditions:',
          '  - type: Ready',
          '    status: "True"',
          `    lastTransitionTime: "${isoAt(startedAt, 11000)}"`,
          `  url: ${endpoint.url}`,
          `  latestReadyRevisionName: ${provisioned.resources[1].name}`,
        ].join('\n'),
      },
    });
  }

  // 2. Zone / high-availability spread.
  checks.push({
    id: 'zones',
    name: `${cloud.terms.zone} redundancy verified`,
    status: 'passed',
    detail: `Workload is spread across ${zones.length} ${cloud.terms.zone.toLowerCase()}(s): ${zoneList}.`,
    evidence: {
      label: 'Zone placement',
      kind: 'json',
      content: JSON.stringify(
        { region: region.id, zones, replicas: zones.length, zoneRedundant: zones.length > 1 },
        null,
        2
      ),
    },
  });

  // 3. HTTP reachability of the app endpoint.
  checks.push({
    id: 'http',
    name: 'Endpoint reachable (HTTP 200)',
    status: 'passed',
    detail: `GET ${endpoint.url} returned 200 OK in ${latency} ms.`,
    evidence: {
      label: `curl -i ${endpoint.url}`,
      kind: 'http',
      content: [
        `> GET / HTTP/1.1`,
        `> Host: ${endpoint.host}`,
        `> User-Agent: courier-verify/1.0`,
        ``,
        `< HTTP/1.1 200 OK`,
        `< date: ${httpDate}`,
        `< content-type: text/html; charset=utf-8`,
        `< x-request-id: ${requestId}`,
        `< x-response-time: ${latency}ms`,
        ``,
        `<!doctype html><title>${workload.title}</title>`,
      ].join('\n'),
    },
  });

  // 4. Application health endpoint.
  checks.push({
    id: 'health',
    name: 'Health probe passing',
    status: 'passed',
    detail: `GET ${endpoint.healthUrl} returned a healthy status.`,
    evidence: {
      label: `curl -s ${endpoint.healthUrl}`,
      kind: 'json',
      content: JSON.stringify(
        {
          status: 'ok',
          workload: workload.key,
          storage: workload.storage,
          checkedAt: isoAt(startedAt, 12500),
        },
        null,
        2
      ),
    },
  });

  // 5. Storage / dependency wiring specific to the workload.
  checks.push({
    id: 'storage',
    name: `${workload.storage === 'table' ? 'Table' : 'Blob'} storage connected`,
    status: 'passed',
    detail: `The ${workload.title} API successfully reached its ${workload.storage} storage backend.`,
    evidence: {
      label: 'Application log (startup)',
      kind: 'text',
      content: [
        `${isoAt(startedAt, 8000)} info  starting ${workload.key} api`,
        `${isoAt(startedAt, 8200)} info  connecting to ${workload.storage} storage`,
        `${isoAt(startedAt, 8600)} info  ${workload.storage} storage connection ok`,
        `${isoAt(startedAt, 8700)} info  listening on :${workload.apiPort}`,
      ].join('\n'),
    },
  });

  // 6. Owner tagging / governance.
  checks.push({
    id: 'tags',
    name: 'Owner tags applied',
    status: 'passed',
    detail: `Resources are tagged with owner ${owner.name} <${owner.email}>.`,
    evidence: {
      label: 'Resource tags',
      kind: 'json',
      content: JSON.stringify(
        {
          owner: owner.name,
          ownerEmail: owner.email,
          instance: instanceName,
          [cloud.terms.subscription.toLowerCase()]: subscription.id,
        },
        null,
        2
      ),
    },
  });

  return checks;
}

/**
 * Run a full simulated deployment + verification for resolved answers.
 * @param {object} answers Resolved deployment answers (see validateDeployment).
 * @returns {object} deployment result
 */
function runDeployment(answers) {
  const startedAt = new Date();
  const provisioned = provisionResources(answers, startedAt);
  const checks = buildChecks(answers, provisioned, startedAt);
  const durationMs = rand(14000, 26000);

  const passed = checks.filter((c) => c.status === 'passed').length;
  const total = checks.length;

  return {
    simulated: true,
    startedAt: startedAt.toISOString(),
    finishedAt: isoAt(startedAt, durationMs),
    durationMs,
    workload: { key: answers.workload.key, title: answers.workload.title },
    cloud: { key: answers.cloud.key, title: answers.cloud.title, cli: answers.cloud.cli },
    target: {
      subscription: answers.subscription,
      subscriptionTerm: answers.cloud.terms.subscription,
      region: { id: answers.region.id, name: answers.region.name },
      zones: answers.zones,
    },
    instance: { name: answers.instanceName, owner: answers.owner },
    endpoint: provisioned.endpoint,
    resources: provisioned.resources,
    checks,
    confidence: {
      level: passed === total ? 'high' : passed >= total - 1 ? 'medium' : 'low',
      passed,
      total,
      summary:
        passed === total
          ? `All ${total} verification checks passed.`
          : `${passed} of ${total} verification checks passed.`,
      rationale: checks.map((c) => `${c.status === 'passed' ? '✓' : '✗'} ${c.name} — ${c.detail}`),
    },
  };
}

module.exports = { runDeployment };
