import { V1OwnerReference, V1Pod, V1PodStatus } from '@kubernetes/client-node';
import { IKubeImage } from '../transmitter/types';
import { currentClusterName } from './cluster';
import { KubeObjectMetadata } from './types';
import { getSupportedWorkload, getWorkloadReader } from './workload-reader';
import logger = require('../common/logger');

const loopingThreshold = 20;

// Constructs the workload metadata based on a variety of k8s properties.
// https://www.notion.so/snyk/Kubernetes-workload-fields-we-should-collect-c60c8f0395f241978282173f4c133a34
export function buildImageMetadata(workloadMeta: KubeObjectMetadata, podStatus?: V1PodStatus): IKubeImage[] {
  const { kind, objectMeta, specMeta, containers } = workloadMeta;
  const { name, namespace, labels, annotations, uid } = objectMeta;

  // hideous hack because this function is called from both a "create" and "delete" context
  // the "delete" context doesn't have the podStatus since it's called from a controller deletion
  let containerDataArray;
  if (podStatus !== undefined) {
    containerDataArray = podStatus.containerStatuses!;
  } else {
    containerDataArray = containers;
  }

  const images = containerDataArray.map(({ name: containerName, image, imageID }) => ({
      type: kind,
      name: name || 'unknown',
      namespace,
      labels: labels || {},
      annotations: annotations || {},
      uid,
      specLabels: specMeta.labels || {},
      specAnnotations: specMeta.annotations || {},
      containerName,
      imageName: image,
      imageId: imageID,
      cluster: currentClusterName,
    } as IKubeImage),
  );
  return images;
}

async function findParentWorkload(
  ownerRefs: V1OwnerReference[] | undefined,
  namespace: string,
): Promise<KubeObjectMetadata | undefined> {
  let ownerReferences = ownerRefs;
  let parentMetadata: KubeObjectMetadata | undefined;

  for (let i = 0; i < loopingThreshold; i++) {
    // We are interested only in a subset of all workloads.
    const supportedWorkload = getSupportedWorkload(ownerReferences);

    if (supportedWorkload === undefined) {
      // Reached the top (or an unsupported workload): return the current parent metadata.
      return parentMetadata;
    }

    const workloadReader = getWorkloadReader(supportedWorkload.kind);
    const nextParentMetadata = await workloadReader(supportedWorkload.name, namespace);
    if (nextParentMetadata === undefined) {
      // Could not extract data for the next parent, so return whatever we have so far.
      return parentMetadata;
    }

    parentMetadata = nextParentMetadata;
    ownerReferences = parentMetadata.ownerRefs;
  }

  return undefined;
}

export async function buildMetadataForWorkload(pod: V1Pod): Promise<IKubeImage[] | undefined> {
  const isAssociatedWithParent = isPodAssociatedWithParent(pod);

  if (!pod.metadata || pod.metadata.namespace === undefined || !pod.spec) {
    // Some required parameters are missing, we cannot process further
    return undefined;
  }

  if (!pod.status) {
    logger.warn({pod}, 'pod lacks status');
    return undefined;
  }

  // Pods that are not associated with any workloads
  // do not need to be read with the API (we already have their meta+spec)
  // so just return the information directly.
  if (!isAssociatedWithParent) {
    return buildImageMetadata({
      kind: 'Pod', // Reading pod.kind may be undefined, so use this
      objectMeta: pod.metadata,
      // Notice the pod.metadata repeats; this is because pods
      // do not have the "template" property.
      specMeta: pod.metadata,
      ownerRefs: [],
      containers: pod.spec.containers,
    },
    pod.status,
    );
  }

  const podOwner: KubeObjectMetadata | undefined = await findParentWorkload(
    pod.metadata.ownerReferences, pod.metadata.namespace);

  return podOwner === undefined
    ? undefined
    : buildImageMetadata(podOwner, pod.status);
}

export function isPodAssociatedWithParent(pod: V1Pod): boolean {
  return pod.metadata !== undefined && pod.metadata.ownerReferences !== undefined
    ? pod.metadata.ownerReferences.some((owner) => !!owner.kind)
    : false;
}
