'use strict';

const DEFAULT_REPO = 'https://github.com/chadhage/experimental.git';

/**
 * Build the ordered list of shell commands that would deploy the chosen
 * workload from GitHub to the chosen cloud. These commands are illustrative
 * and printed for review; the wizard never runs them automatically.
 *
 * @param {object} answers Resolved deployment answers (see validateDeployment).
 * @returns {string[]} commands
 */
function buildCommands(answers) {
  const { cloud, workload, subscription, region, zones, instanceName, owner } = answers;
  const apiPath = `${workload.path}/api`;
  const zoneList = zones.join(',');
  const repoUrl = answers.source?.repoUrl || DEFAULT_REPO;
  const branch = answers.source?.branch || 'main';

  const clone = [
    `# 1. Fetch the workload source from GitHub`,
    `git clone --branch ${branch} --depth 1 ${repoUrl} courier-src`,
    `cd courier-src/${apiPath}`,
  ];

  if (cloud.key === 'azure') {
    const rg = `${instanceName}-rg`;
    return [
      ...clone,
      ``,
      `# 2. Select the subscription (already signed in via SSO)`,
      `az account set --subscription ${subscription.id}`,
      ``,
      `# 3. Create the resource group, tagged with the instance owner`,
      `az group create --name ${rg} --location ${region.id} \\`,
      `  --tags owner="${owner.name}" ownerEmail="${owner.email}" instance="${instanceName}"`,
      ``,
      `# 4. Deploy the App Service web app across zones ${zoneList}`,
      `az appservice plan create --name ${instanceName}-plan --resource-group ${rg} \\`,
      `  --location ${region.id} --sku P1v3 --zone-redundant --number-of-workers ${zones.length}`,
      `az webapp up --name ${instanceName} --resource-group ${rg} \\`,
      `  --plan ${instanceName}-plan --runtime "NODE:20-lts"`,
    ];
  }

  if (cloud.key === 'aws') {
    return [
      ...clone,
      ``,
      `# 2. Confirm the active account ${subscription.id} (signed in via SSO)`,
      `aws sts get-caller-identity`,
      `export AWS_REGION=${region.id}`,
      ``,
      `# 3. Deploy with Elastic Beanstalk across zones ${zoneList}`,
      `eb init ${instanceName} --platform node.js --region ${region.id}`,
      `eb create ${instanceName} \\`,
      `  --elb-type application \\`,
      `  --vpc.elbsubnets ${zoneList} \\`,
      `  --tags owner="${owner.name}",ownerEmail="${owner.email}"`,
    ];
  }

  if (cloud.key === 'gcp') {
    return [
      ...clone,
      ``,
      `# 2. Select the project ${subscription.id} (signed in via SSO)`,
      `gcloud config set project ${subscription.id}`,
      `gcloud config set run/region ${region.id}`,
      ``,
      `# 3. Deploy to Cloud Run across zones ${zoneList}`,
      `gcloud run deploy ${instanceName} \\`,
      `  --source . \\`,
      `  --region ${region.id} \\`,
      `  --labels owner=${labelize(owner.name)},instance=${instanceName} \\`,
      `  --allow-unauthenticated`,
      `# Zones targeted: ${zoneList}`,
    ];
  }

  return clone;
}

function labelize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 63);
}

/**
 * Build a serializable plan/answers record for saving to disk or sending to
 * the browser.
 */
function buildPlan(answers) {
  return {
    createdAt: new Date().toISOString(),
    workload: {
      key: answers.workload.key,
      title: answers.workload.title,
      path: answers.workload.path,
    },
    source: {
      provider: 'github',
      repoUrl: answers.source?.repoUrl || DEFAULT_REPO,
      branch: answers.source?.branch || 'main',
    },
    cloud: {
      key: answers.cloud.key,
      title: answers.cloud.title,
      cli: answers.cloud.cli,
    },
    target: {
      subscription: answers.subscription,
      region: { id: answers.region.id, name: answers.region.name },
      zones: answers.zones,
    },
    instance: {
      name: answers.instanceName,
      owner: answers.owner,
    },
  };
}

module.exports = { buildCommands, buildPlan, DEFAULT_REPO };
