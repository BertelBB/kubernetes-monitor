import * as tap from 'tap';

import { IPullableImage } from '../../../src/scanner/images/types';
import config = require('../../../src/common/config');
import * as scannerImages from '../../../src/scanner/images';


tap.test('getImagesWithFileSystemPath()', async (t) => {
  const noImages: string[] = [];
  const noImagesResult = scannerImages.getImagesWithFileSystemPath(noImages);
  t.same(noImagesResult, [], 'correctly maps an empty array');

  const image = ['nginx:latest'];
  const imageResult = scannerImages.getImagesWithFileSystemPath(image);
  t.same(imageResult.length, 1, 'expected 1 item');

  const resultWithExpectedPath = imageResult[0];
  t.same(
    resultWithExpectedPath.imageName,
    'nginx:latest',
    'correctly returns an image without a file system path',
  );
  const fileSystemPath = resultWithExpectedPath.fileSystemPath;
  t.ok(fileSystemPath, 'file system path exists on the result');
  t.ok(fileSystemPath.endsWith('.tar'), 'file system path ends in .tar');

  const expectedPattern = fileSystemPath.indexOf(`${config.IMAGE_STORAGE_ROOT}/nginx_latest_`) !== -1;
  t.ok(expectedPattern, 'the file system path starts with an expected pattern');

  // Ensure that two consecutive calls do not return the same file system path
  const someImage = ['centos:latest'];
  const firstCallResult = scannerImages.getImagesWithFileSystemPath(someImage)[0];
  const secondCallResult = scannerImages.getImagesWithFileSystemPath(someImage)[0];
  t.ok(
    firstCallResult.fileSystemPath !== secondCallResult.fileSystemPath,
    'consecutive calls to the function with the same data return different file system paths',
  );
});

tap.test('pullImages() skips on missing file system path', async (t) => {
  const badImage = [{imageName: 'nginx:latest'}];
  const result = await scannerImages.pullImages(badImage as IPullableImage[]);
  t.same(result, [], 'expect to skip images missing file system path');
});

tap.test('constructStaticAnalysisOptions() tests', async (t) => {
  t.plan(1);

  const somePath = '/var/tmp/file.tar';
  const options = scannerImages.constructStaticAnalysisOptions(somePath);
  const expectedResult = {
    imagePath: somePath,
    imageType: 'docker-archive',
  };

  t.deepEqual(options, expectedResult, 'returned options match expectations');
});

tap.test('extracted image tag tests', async (t) => {
  t.plan(6);

  const imageWithSha = 'nginx@sha256:1234567890abcdef';
  const imageWithShaResult = scannerImages.getImageParts(imageWithSha);
  t.same(imageWithShaResult.imageTag, '1234567890abcdef', 'image sha is returned');

  const imageWithTag = 'nginx:latest';
  const imageWithTagResult = scannerImages.getImageParts(imageWithTag);
  t.same(imageWithTagResult.imageTag, 'latest', 'image tag is returned');

  const imageWithFullRepository = 'kind-registry:5000/nginx:latest';
  const imageWithFullRepositoryResult = scannerImages.getImageParts(imageWithFullRepository);
  t.same(imageWithFullRepositoryResult.imageTag, 'latest', 'image tag is returned when full repo specified');

  const imageWithoutTag = 'nginx';
  const imageWithoutTagResult = scannerImages.getImageParts(imageWithoutTag);
  t.same(imageWithoutTagResult.imageTag, '', 'empty tag returned when no tag is specified');

  const imageWithManySeparators = 'nginx@abc:tag@bad:reallybad';
  const imageWithManySeparatorsResult = scannerImages.getImageParts(imageWithManySeparators);
  t.same(imageWithManySeparatorsResult.imageTag, '', 'empty tag is returned on malformed image name and tag');

  const imageWithFullRepoAndManySeparators = 'kind-registry:5000/nginx@abc:tag@bad:reallybad';
  const imageWithFullRepoAndManySeparatorsResult = scannerImages.getImageParts(imageWithFullRepoAndManySeparators);
  t.same(imageWithFullRepoAndManySeparatorsResult.imageTag, '', 'empty tag is returned on malformed image name and tag with full repo');
});

tap.test('extracted image name tests', async (t) => {
  t.plan(4);

  t.same(scannerImages.getImageParts('nginx:latest').imageName, 'nginx', 'removed image:tag');
  t.same(scannerImages.getImageParts('nginx:@sha256:1234567890abcdef').imageName, 'nginx', 'removed malformed image:@sha:hex');
  t.same(scannerImages.getImageParts('node@sha256:215a9fbef4df2c1ceb7c79481d3cfd94ad8f1f0105bade39f3be907bf386c5e1').imageName, 'node', 'removed image@sha:hex');
  t.same(scannerImages.getImageParts('kind-registry:5000/python:rc-buster').imageName, 'kind-registry:5000/python', 'removed repository/image:tag');
});
