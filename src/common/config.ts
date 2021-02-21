import * as uuidv4 from 'uuid/v4';
import { loadConfig } from 'snyk-config';
import * as fs from 'fs';

const config: Record<string, any> = loadConfig(__dirname + '/../..', {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

const namespacesFilePath = '/etc/config/namespaces';

function loadExcludedNamespaces(): string[] | null {
  try {
    const data = fs.readFileSync(namespacesFilePath, 'UTF-8');
    const namespaces: string[] = data.split(/\r?\n/);
    return namespaces;
  } catch (err) {
    return null;
  }
}

config.AGENT_ID = uuidv4();
config.INTEGRATION_ID = config.INTEGRATION_ID.trim();
config.CLUSTER_NAME = config.CLUSTER_NAME || 'Default cluster';
config.IMAGE_STORAGE_ROOT = '/var/tmp';
config.EXCLUDED_NAMESPACES = loadExcludedNamespaces();

/**
 * Important: we delete the following env vars because we don't want to proxy requests to the Kubernetes API server.
 * The Kubernetes client library would honor the NO/HTTP/HTTPS_PROXY env vars.
 */
config.HTTPS_PROXY = process.env['HTTPS_PROXY'];
config.HTTP_PROXY = process.env['HTTP_PROXY'];
config.NO_PROXY = process.env['NO_PROXY'];
delete process.env['HTTPS_PROXY'];
delete process.env['HTTP_PROXY'];
delete process.env['NO_PROXY'];

config.SKIP_K8S_JOBS = process.env.SKIP_K8S_JOBS === 'true';

export { config };
