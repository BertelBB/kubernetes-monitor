import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as needle from 'needle';

export async function downloadKubectl(k8sRelease: string, osDistro: string): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'kubectl'), constants.R_OK);
  } catch (error) {
    console.log('Downloading kubectl...');

    const bodyData = null;
    // eslint-disable-next-line @typescript-eslint/camelcase
    const requestOptions = { follow_max: 2 };
    await needle('get', 'https://storage.googleapis.com/kubernetes-release/release/' +
      `${k8sRelease}/bin/${osDistro}/amd64/kubectl`,
      bodyData,
      requestOptions,
    ).then((response) => {
      writeFileSync('kubectl', response.body);
      chmodSync('kubectl', 0o755); // rwxr-xr-x
    });

    console.log('kubectl downloaded!');
  }
}

export async function createNamespace(namespace: string): Promise<void> {
  console.log(`Creating namespace ${namespace}...`);
  await exec(`./kubectl create namespace ${namespace}`);
  console.log(`Created namespace ${namespace}!`);
}

export async function createSecret(
  secretName: string,
  namespace: string,
  secrets: { [key: string]: string },
  secretsKeyPrefix = '--from-literal=',
  secretType = 'generic',
): Promise<void> {
  console.log(`Creating secret ${secretName} in namespace ${namespace}...`);
  const secretsAsKubectlArgument = Object.keys(secrets)
    .reduce((prev, key) => `${prev} ${secretsKeyPrefix}${key}='${secrets[key]}'`, '');
  await exec(`./kubectl create secret ${secretType} ${secretName} -n ${namespace} ${secretsAsKubectlArgument}`);
  console.log(`Created secret ${secretName}!`);
}

export async function applyK8sYaml(pathToYamlDeployment: string): Promise<void> {
  console.log(`Applying ${pathToYamlDeployment}...`);
  await exec(`./kubectl apply -f ${pathToYamlDeployment}`);
  console.log(`Applied ${pathToYamlDeployment}!`);
}

export async function createDeploymentFromImage(name: string, image: string, namespace: string) {
  console.log(`Letting Kubernetes decide how to manage image ${image} with name ${name}`);
  await exec(`./kubectl run ${name} --image=${image} -n ${namespace}`);
  console.log(`Done Letting Kubernetes decide how to manage image ${image} with name ${name}`);
}

export async function deleteDeployment(deploymentName: string, namespace: string) {
  console.log(`Deleting deployment ${deploymentName} in namespace ${namespace}...`);
  await exec(`./kubectl delete deployment ${deploymentName} -n ${namespace}`);
  console.log(`Deleted deployment ${deploymentName}!`);
}

export async function deletePod(podName: string, namespace: string) {
  console.log(`Deleting pod ${podName} in namespace ${namespace}...`);
  await exec(`./kubectl delete pod ${podName} -n ${namespace}`);
  console.log(`Deleted pod ${podName}!`);
}

export async function getDeploymentJson(deploymentName: string, namespace: string): Promise<any> {
  const getDeploymentResult = await exec(`./kubectl get deployment ${deploymentName} -n ${namespace} -o json`);
  return JSON.parse(getDeploymentResult.stdout);
}
