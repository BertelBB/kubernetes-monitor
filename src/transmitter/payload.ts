import config = require('../common/config');
import { currentClusterName } from '../kube-scanner/cluster';
import { ScanResult } from '../kube-scanner/image-scanner';
import { IDeleteWorkloadPayload, IDepGraphPayload, IKubeImage, ILocalWorkloadLocator, IImageLocator } from './types';

export function constructHomebaseWorkloadPayloads(
    scannedImages: ScanResult[],
    workloadMetadata: IKubeImage[],
): IDepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    const kubeImage: IKubeImage = workloadMetadata.find((meta) => meta.imageName === scannedImage.imageWithTag)!;

    const { cluster, namespace, type, name } = kubeImage;

    const imageLocator: IImageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
      cluster,
      namespace,
      type,
      name,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
    } as IDepGraphPayload;
  });

  return results;
}

export function constructHomebaseDeleteWorkloadPayload(
  localWorkloadLocator: ILocalWorkloadLocator,
): IDeleteWorkloadPayload {
  return {
    workloadLocator: {
      ...localWorkloadLocator,
      userLocator: config.INTEGRATION_ID,
      cluster: currentClusterName,
    },
    agentId: config.AGENT_ID,
  };
}
