'use strict';

const { getCloud } = require('./clouds');

/**
 * Simulated single sign-on.
 *
 * Courier never contacts a real identity provider and never holds cloud
 * credentials — it only generates a deployment script for manual review. This
 * module fakes an SSO result so the guided flow can show a "signed-in" identity
 * and offer the subscriptions/accounts/projects defined for the chosen cloud.
 *
 * @param {string} cloudKey  Cloud to "sign in" to.
 * @returns {{ provider: string, identity: object, subscriptions: object[] } | null}
 */
function signIn(cloudKey) {
  const cloud = getCloud(cloudKey);
  if (!cloud) {
    return null;
  }

  const providerLabel = {
    azure: 'Microsoft Entra ID',
    aws: 'AWS IAM Identity Center',
    gcp: 'Google Cloud Identity',
  }[cloud.key] || 'SSO';

  return {
    provider: providerLabel,
    simulated: true,
    identity: {
      name: 'Casey Deployer',
      email: 'casey.deployer@example.com',
      org: providerLabel,
      signedInAt: new Date().toISOString(),
    },
    subscriptions: cloud.subscriptions.map((s) => ({ ...s })),
    subscriptionTerm: cloud.terms.subscription,
  };
}

module.exports = { signIn };
