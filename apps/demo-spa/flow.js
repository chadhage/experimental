/* Flow definition — mirrors deploy/wizard.ps1 question set & branching.
   One question per "turn". `when` controls visibility based on prior answers. */

const SOURCE_TYPES = ['sqlserver', 'databricks', 'snowflake', 'sharepoint', 'excelonline'];

const ISOLATION = [
  { value: 'A', label: 'A — Shared compute + shared data, public endpoint' },
  { value: 'B', label: 'B — Shared compute + shared data, public OR private (VPN/IPSec)' },
  { value: 'C', label: 'C — Isolated compute + isolated data, in OUR cloud' },
  { value: "D", label: "D — Deployed into the CUSTOMER's own tenant/cloud" },
];

/** tier derived from isolation answer */
function tierFor(iso) {
  if (iso === 'A' || iso === 'B') return 'shared';
  if (iso === 'C') return 'isolated';
  return 'byo';
}

/** Each step: id, section, prompt, type, options/default, and a `when` predicate. */
const STEPS = [
  {
    id: 'instanceName', section: 'Identity', type: 'text', default: 'contoso-prod',
    prompt: 'Q1. Name this product instance',
    help: 'Used to name all provisioned resources.',
  },
  {
    id: 'isolation', section: 'Isolation model', type: 'choice', options: ISOLATION,
    prompt: 'Q2. Choose your isolation & residency model',
    help: 'This single answer drives the whole branch — which Terraform stack runs.',
  },
  {
    id: 'designerSurface', section: 'Designer experience', type: 'choice',
    options: [
      { value: 'web', label: 'Web browser' },
      { value: 'app', label: 'Client app' },
      { value: 'vscode', label: 'VS Code extension' },
    ],
    default: 'web',
    prompt: 'Q3. Which designer surface will the customer use?',
  },
  {
    id: 'region', section: 'Region', type: 'text', default: 'eastus2',
    prompt: 'Q4. Deployment region',
  },
  // --- isolated/BYO only ---
  {
    id: 'cloud', section: 'Customer cloud', type: 'choice',
    options: [
      { value: 'azure', label: 'Azure' },
      { value: 'aws', label: 'AWS' },
      { value: 'gcp', label: 'GCP' },
    ],
    default: 'azure',
    prompt: 'Q5. Target cloud',
    when: (a) => a.isolation === 'D',
  },
  {
    id: 'tenantId', section: 'Dedicated tenancy', type: 'text', default: '',
    prompt: 'Q6. Tenant / account id (GUID)',
    when: (a) => a.isolation === 'C' || a.isolation === 'D',
  },
  {
    id: 'subscriptionId', section: 'Dedicated tenancy', type: 'text', default: '',
    prompt: 'Q7. Subscription / project id',
    when: (a) => a.isolation === 'C' || a.isolation === 'D',
  },
  {
    id: 'credentialRef', section: 'Dedicated tenancy', type: 'text', default: 'kv://customer-sp',
    prompt: 'Q8. Credential reference (service principal / IAM role / WIF)',
    when: (a) => a.isolation === 'D',
  },
  // --- data source (always) ---
  {
    id: 'dataSourceType', section: 'Data source', type: 'choice',
    options: SOURCE_TYPES.map((t) => ({ value: t, label: t })),
    default: 'sqlserver',
    prompt: 'Q9. Data source type',
  },
  {
    id: 'dataConnectivity', section: 'Data source', type: 'choice',
    options: [
      { value: 'internet', label: 'Public internet' },
      { value: 'ipsec', label: 'Private (VPN / IPSec)' },
    ],
    default: 'internet',
    prompt: 'Q10. Connectivity to the data source',
    when: (a) => ['B', 'C', 'D'].includes(a.isolation),
  },
  {
    id: 'dataSourceHost', section: 'Data source', type: 'text', default: 'sql.contoso.com',
    prompt: 'Q11. Data source host / endpoint',
  },
  // --- endpoint exposure ---
  {
    id: 'endpointExposure', section: 'Published endpoint', type: 'choice',
    options: [
      { value: 'public', label: 'Public internet' },
      { value: 'private', label: 'Private (VPN / IPSec)' },
    ],
    default: 'public',
    prompt: 'Q12. How is the published endpoint exposed?',
    when: (a) => a.isolation !== 'A', // Option A is public-only
  },
];

/** Build the artifacts the wizard would emit (answers.json + tfvars + target env). */
function buildArtifacts(a) {
  const tier = tierFor(a.isolation);
  const answers = {
    instanceName: a.instanceName,
    isolation: a.isolation,
    designerSurface: a.designerSurface,
    region: a.region,
    tier,
    ...(a.cloud ? { cloud: a.cloud } : {}),
    ...(a.tenantId ? { tenantId: a.tenantId } : {}),
    ...(a.subscriptionId ? { subscriptionId: a.subscriptionId } : {}),
    ...(a.credentialRef ? { credentialRef: a.credentialRef } : {}),
    dataSourceType: a.dataSourceType,
    dataConnectivity: a.dataConnectivity || 'internet',
    dataSourceHost: a.dataSourceHost,
    endpointExposure: a.isolation === 'A' ? 'public' : a.endpointExposure || 'public',
    createdUtc: new Date().toISOString(),
  };

  const tfvars = {
    instance_name: answers.instanceName,
    isolation: answers.isolation,
    designer_surface: answers.designerSurface,
    region: answers.region,
    cloud: answers.cloud || 'azure',
    tenant_id: answers.tenantId || '',
    subscription_id: answers.subscriptionId || '',
    data_source_type: answers.dataSourceType,
    data_connectivity: answers.dataConnectivity,
    data_source_host: answers.dataSourceHost,
    endpoint_exposure: answers.endpointExposure,
  };

  const envDir = `infra/environments/${tier}`;

  // The components that get provisioned, by tier — shown as the "deployment plan".
  const plan = planFor(answers);

  return { answers, tfvars, envDir, tier, plan };
}

function planFor(a) {
  const base = [
    `Resource group (rg-${a.tier}-${a.instanceName})`,
    `Designer UI — ${a.designerSurface} surface`,
    'Publish API (Container Apps)',
    'Endpoint gateway (API Management)',
    'Secrets vault (Key Vault, secret reference only)',
  ];
  const meta =
    a.tier === 'shared'
      ? ['Tenant metadata — SHARED Cosmos DB (partitioned by /tenantId)']
      : ['Tenant metadata — DEDICATED Cosmos DB (100% isolated)'];
  const net = [];
  if (a.tier !== 'shared' || a.endpointExposure === 'private') {
    net.push('Dedicated VNet + subnets + NSGs');
  }
  if (a.dataConnectivity === 'ipsec' || a.endpointExposure === 'private') {
    net.push('VPN Gateway (IKEv2 / IPSec site-to-site)');
    net.push('Private Endpoints + Private DNS');
  }
  const cloudNote =
    a.tier === 'byo'
      ? [`Provider: ${(a.cloud || 'azure').toUpperCase()} — deployed into the customer's own ${a.cloud === 'aws' ? 'account' : a.cloud === 'gcp' ? 'project' : 'subscription'}`]
      : a.tier === 'isolated'
      ? ['Dedicated subscription in our cloud']
      : ['Multi-tenant — runs side-by-side with other customers'];

  return [...cloudNote, ...base, ...meta, ...net];
}

window.QDFlow = { STEPS, buildArtifacts, tierFor, ISOLATION };
