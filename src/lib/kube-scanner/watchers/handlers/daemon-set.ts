import { V1DaemonSet } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';

export async function daemonSetWatchHandler(eventType: string, daemonSet: V1DaemonSet) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  const logId = uuidv4().substring(0, 8);

  await deleteWorkload({
    kind: 'DaemonSet',
    objectMeta: daemonSet.metadata,
    specMeta: daemonSet.spec.template.metadata,
    containers: daemonSet.spec.template.spec.containers,
    ownerRefs: daemonSet.metadata.ownerReferences,
  }, logId);
}
