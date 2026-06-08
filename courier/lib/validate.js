'use strict';

const { getCloud } = require('./clouds');
const { getWorkload } = require('./workloads');

const INSTANCE_NAME = /^[a-z][a-z0-9-]{2,38}[a-z0-9]$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validate the full guided-deployment selection from any front end (CLI or web)
 * and resolve the referenced subscription/region/zones to their full objects.
 *
 * @param {object} input
 * @param {string} input.workload        Workload key.
 * @param {string} input.cloud           Cloud key.
 * @param {string} input.subscriptionId  Selected subscription/account/project id.
 * @param {string} input.regionId        Selected region id.
 * @param {string[]} input.zones         Selected zone ids (>= 1).
 * @param {string} input.instanceName    Resource/instance name.
 * @param {string} input.ownerName       Instance owner display name.
 * @param {string} input.ownerEmail      Instance owner email.
 * @returns {{ errors: string[], answers: object|null }}
 */
function validateDeployment(input) {
  const errors = [];

  const workload = getWorkload(input.workload);
  if (!workload) {
    errors.push('Select a valid workload.');
  }

  const cloud = getCloud(input.cloud);
  if (!cloud) {
    errors.push('Select a valid cloud.');
    return { errors, answers: null };
  }

  const subscription = cloud.subscriptions.find((s) => s.id === input.subscriptionId) || null;
  if (!subscription) {
    errors.push(`Select a valid ${cloud.terms.subscription.toLowerCase()}.`);
  }

  const region = cloud.regions.find((r) => r.id === input.regionId) || null;
  if (!region) {
    errors.push(`Select a valid ${cloud.terms.region.toLowerCase()}.`);
  }

  const requestedZones = Array.isArray(input.zones) ? input.zones : [];
  let zones = [];
  if (region) {
    zones = requestedZones.filter((z) => region.zones.includes(z));
    if (zones.length === 0) {
      errors.push(`Select at least one ${cloud.terms.zone.toLowerCase()}.`);
    }
  }

  const instanceName = String(input.instanceName || '').trim();
  if (!INSTANCE_NAME.test(instanceName)) {
    errors.push('Instance name must be 4-40 chars: lowercase letters, digits, hyphens; start with a letter.');
  }

  const ownerName = String(input.ownerName || '').trim();
  if (!ownerName) {
    errors.push('Instance owner name is required.');
  }

  const ownerEmail = String(input.ownerEmail || '').trim();
  if (!EMAIL.test(ownerEmail)) {
    errors.push('Instance owner email must be a valid email address.');
  }

  if (errors.length) {
    return { errors, answers: null };
  }

  return {
    errors: [],
    answers: {
      workload,
      cloud,
      subscription,
      region,
      zones,
      instanceName,
      owner: { name: ownerName, email: ownerEmail },
    },
  };
}

module.exports = { validateDeployment, INSTANCE_NAME, EMAIL };
