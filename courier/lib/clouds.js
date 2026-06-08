'use strict';

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Target clouds with the metadata the guided flow needs:
 * - `terms`: what each cloud calls a subscription / region / zone.
 * - `subscriptions`: the accounts returned by the (simulated) SSO sign-in.
 * - `regions`: selectable regions, each with its availability zones.
 *
 * Subscriptions/regions/zones are illustrative sample data. The wizard never
 * contacts a cloud; it generates a reviewable deployment script.
 */
const CLOUDS = [
  {
    key: 'azure',
    title: 'Microsoft Azure',
    description: 'Deploy with the Azure CLI (az)',
    cli: 'az',
    terms: { subscription: 'Subscription', region: 'Region', zone: 'Availability zone' },
    subscriptions: [
      { id: 'a1b2c3d4-1111-4aaa-8bbb-0123456789ab', name: 'Production' },
      { id: 'a1b2c3d4-2222-4aaa-8bbb-0123456789ab', name: 'Staging' },
      { id: 'a1b2c3d4-3333-4aaa-8bbb-0123456789ab', name: 'Sandbox' },
    ],
    regions: [
      { id: 'eastus', name: 'East US', zones: ['1', '2', '3'] },
      { id: 'westeurope', name: 'West Europe', zones: ['1', '2', '3'] },
      { id: 'southeastasia', name: 'Southeast Asia', zones: ['1', '2', '3'] },
    ],
  },
  {
    key: 'aws',
    title: 'Amazon Web Services',
    description: 'Deploy with the AWS CLI (aws)',
    cli: 'aws',
    terms: { subscription: 'Account', region: 'Region', zone: 'Availability zone' },
    subscriptions: [
      { id: '111122223333', name: 'prod' },
      { id: '444455556666', name: 'staging' },
      { id: '777788889999', name: 'sandbox' },
    ],
    regions: [
      { id: 'us-east-1', name: 'US East (N. Virginia)', zones: ['us-east-1a', 'us-east-1b', 'us-east-1c'] },
      { id: 'eu-west-1', name: 'Europe (Ireland)', zones: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'] },
      { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', zones: ['ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c'] },
    ],
  },
  {
    key: 'gcp',
    title: 'Google Cloud Platform',
    description: 'Deploy with the gcloud CLI',
    cli: 'gcloud',
    terms: { subscription: 'Project', region: 'Region', zone: 'Zone' },
    subscriptions: [
      { id: 'acme-prod-01', name: 'ACME Production' },
      { id: 'acme-staging-01', name: 'ACME Staging' },
      { id: 'acme-sandbox-01', name: 'ACME Sandbox' },
    ],
    regions: [
      { id: 'us-central1', name: 'Iowa (us-central1)', zones: ['us-central1-a', 'us-central1-b', 'us-central1-c'] },
      { id: 'europe-west1', name: 'Belgium (europe-west1)', zones: ['europe-west1-b', 'europe-west1-c', 'europe-west1-d'] },
      { id: 'asia-east1', name: 'Taiwan (asia-east1)', zones: ['asia-east1-a', 'asia-east1-b', 'asia-east1-c'] },
    ],
  },
];

function getCloud(key) {
  return CLOUDS.find((cloud) => cloud.key === key) || null;
}

module.exports = { CLOUDS, getCloud, GUID };
