const dockerLib = require('./docker')
const childProcess = require('child_process')
jest.mock('child_process')

beforeEach(() => {
  jest.resetModules()
  jest.resetAllMocks()
})

test('getImageIdByContainerId should return imageId when executed successfully', async () => {
  const imageId = 'sha256:b6127a956a40d6aed5e5e1361c5e1d'
  const containerId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(null, { stdout: `${imageId}\n` })
  })
  await expect(dockerLib.getImageIdByContainerId(containerId)).resolves.toBe(
    imageId
  )
})

test('getImageIdByContainerId should throw an exception when exec failed', async () => {
  const containerId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(new Error('failed'), null)
  })
  await expect(dockerLib.getImageIdByContainerId(containerId)).rejects.toThrow()
})

test('stopContainer should execute successfully for a valid containerId', async () => {
  const containerId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(null, {})
  })
  await expect(dockerLib.stopContainer(containerId)).resolves.toBeUndefined()
})

test('stopContainer should throw an exception when exec failed', async () => {
  const containerId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(new Error('failed'), null)
  })
  await expect(dockerLib.stopContainer(containerId)).rejects.toThrow()
})

test('getImageDigestByContainerId should return an image digest when executed successfully', async () => {
  const imageDigest = 'python@sha256:6673d8ce9610d166b6d7d6abda21'
  const containerId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    if (cmd.includes('docker inspect')) {
      callback(null, { stdout: 'dummyimageid\n' })
    } else {
      callback(null, { stdout: `${imageDigest}\n` })
    }
  })
  await expect(
    dockerLib.getImageDigestByContainerId(containerId)
  ).resolves.toBe(imageDigest.split('\n')[0].split('@')[1])
})

test('getImageDigestByContainerId should throw an exception when exec failed', async () => {
  const containerId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    if (cmd.includes('docker inspect')) {
      callback(null, { stdout: 'dummyimageid\n' })
    } else {
      callback(new Error('failed'), null)
    }
  })
  await expect(
    dockerLib.getImageDigestByContainerId(containerId)
  ).rejects.toThrow()
})

test('getImageDigestByImageId should return an image digest when executed successfully', async () => {
  const imageDigest = 'python@sha256:6673d8ce9610d166b6d7d6abda21'
  const imageId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(null, { stdout: `${imageDigest}\n` })
  })
  await expect(dockerLib.getImageDigestByImageId(imageId)).resolves.toBe(
    imageDigest.split('\n')[0].split('@')[1]
  )
})

test('getImageDigestByImageId should throw an exception when exec failed', async () => {
  const imageId = 'a2f637e14286'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(new Error('failed'), null)
  })
  await expect(dockerLib.getImageDigestByImageId(imageId)).rejects.toThrow()
})

test('pullImageByDigest should pull an image when executed successfully', async () => {
  const image = 'python'
  const digest = 'sha256:6673d8ce9610d166b6d7d6abda21'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(null, {})
  })
  await expect(
    dockerLib.pullImageByDigest(image, digest)
  ).resolves.toBeUndefined()
})

test('pullImageByDigest should throw an exception when exec failed', async () => {
  const image = 'python'
  const digest = 'sha256:6673d8ce9610d166b6d7d6abda21'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(new Error('failed'), null)
  })
  await expect(dockerLib.pullImageByDigest(image, digest)).rejects.toThrow()
})

test('localImageExists should pull an image when executed successfully', async () => {
  const image = 'localhost/example/image'
  const digest = 'sha256:4441f95bb54c575300f96912'
  const imageList =
    'localhost/example/imagesha256:4441f95bb54c575300f96912\n' +
    'example/imagesha256:0f5d9cee49b5ca5fbe408727b\n' +
    'sample/imagesha256:b66bef92f35210a952b35de2\n' +
    'unknown/imagesha256:fe8d824220415eed5477b63a'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(null, { stdout: imageList })
  })
  await expect(dockerLib.localImageExists(image, digest)).resolves.toBe(true)
})

test('localImageExists should throw an exception when exec failed', async () => {
  const image = 'python'
  const digest = 'sha256:6673d8ce9610d166b6d7d6abda21'
  childProcess.exec.mockImplementation((cmd, callback) => {
    callback(new Error('failed'), null)
  })
  await expect(dockerLib.localImageExists(image, digest)).resolves.toBe(false)
})
