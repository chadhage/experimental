'use strict';

/**
 * Deployable workloads in this repository. Each maps to a service folder that
 * contains an `api` and a `ui` sub-service.
 */
const WORKLOADS = [
  {
    key: 'helloworld',
    title: 'Hello World',
    description: 'UI + API logging invocations to Azure Table Storage',
    path: 'helloworld/services',
    apiPort: 8080,
    storage: 'table',
  },
  {
    key: 'diceroll',
    title: 'Dice Roll',
    description: 'UI + API logging rolls to a JSON file on Blob storage',
    path: 'diceroll/services',
    apiPort: 8081,
    storage: 'blob',
  },
];

function getWorkload(key) {
  return WORKLOADS.find((workload) => workload.key === key) || null;
}

module.exports = { WORKLOADS, getWorkload };
