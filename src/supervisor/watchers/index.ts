import { makeInformer, ADD, ERROR } from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';

import { logger } from '../../common/logger';
import { config } from '../../common/config';
import { WorkloadKind } from '../types';
import { ECONNRESET_ERROR_CODE } from './types';
import { setupInformer } from './handlers';
import { kubeConfig, k8sApi } from '../cluster';
import * as kubernetesApiWrappers from '../kuberenetes-api-wrappers';
import { kubernetesInternalNamespaces } from './internal-namespaces';

/**
 * This map keeps track of all currently watched namespaces.
 * Prevents duplicate watches being created if the same namespace is deleted
 * and then re-created. Once a watch is set up once, it doesn't have to be
 * tracked anymore as the kubernetes-client Informer API handles this internally.
 */
const watchedNamespaces = new Set<string>();

function setupWatchesForNamespace(namespace: string): void {
  if (watchedNamespaces.has(namespace)) {
    logger.info({namespace}, 'already set up namespace watch, skipping');
    return;
  }

  logger.info({namespace}, 'setting up namespace watch');

  for (const workloadKind of Object.values(WorkloadKind)) {
    // Disable handling events for k8s Jobs for debug purposes
    if (config.SKIP_K8S_JOBS === true && workloadKind === WorkloadKind.Job) {
      continue;
    }

    try {
      setupInformer(namespace, workloadKind);
    } catch (error) {
      logger.warn({namespace, workloadKind}, 'could not setup workload watch, skipping');
    }
  }

  watchedNamespaces.add(namespace);
}

export function extractNamespaceName(namespace: V1Namespace): string {
  if (namespace && namespace.metadata && namespace.metadata.name) {
    return namespace.metadata.name;
  }
  throw new Error('Namespace missing metadata.name');
}

export function isKubernetesInternalNamespace(namespace: string): boolean {
  return kubernetesInternalNamespaces.includes(namespace);
}

export function isExcludedNamespace(namespace: string): boolean {
  if (!config.EXCLUDED_NAMESPACES) {
    return false;
  }

  return config.EXCLUDED_NAMESPACES.includes(namespace);
}

function setupWatchesForCluster(): void {
  const informer = makeInformer(
    kubeConfig,
    '/api/v1/namespaces',
    async () => {
      try {
        return await kubernetesApiWrappers.retryKubernetesApiRequest(
          () => k8sApi.coreClient.listNamespace());
      } catch (err) {
        logger.error({err}, 'error while listing namespaces');
        throw err;
      }
    },
  );

  informer.on(ERROR, (err) => {
    // Types from client library insists that callback is of type V1Namespace
    if ((err as any).code === ECONNRESET_ERROR_CODE) {
      logger.debug(`namespace informer ${ECONNRESET_ERROR_CODE} occurred, restarting informer`);

      // Restart informer after 1sec
      setTimeout(() => {
        informer.start();
      }, 1000);
    } else {
      logger.error({ err }, 'unexpected namespace informer error event occurred');
    }
  });

  informer.on(ADD, (namespace: V1Namespace) => {
    try {
      const namespaceName = extractNamespaceName(namespace);
      if (isKubernetesInternalNamespace(namespaceName) || isExcludedNamespace(namespaceName)) {
        // disregard namespaces internal to kubernetes
        logger.info({namespaceName}, 'ignoring blacklisted namespace');
        return;
      }

      setupWatchesForNamespace(namespaceName);
    } catch (err) {
      logger.error({err, namespace}, 'error handling a namespace event');
      return;
    }
  });

  informer.start();
}

export function beginWatchingWorkloads(): void {
  if (config.NAMESPACE) {
    logger.info({namespace: config.NAMESPACE}, 'kubernetes-monitor restricted to specific namespace');
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  setupWatchesForCluster();
}

