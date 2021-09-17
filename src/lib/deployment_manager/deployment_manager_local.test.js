const deploymentModel = require('../../models/deployment')
const CONST = require('../constant')
const dockerLib = require('../docker')
const logger = require('../logger')

jest.mock('../../models/deployment')
jest.mock('../constant')
jest.mock('../docker')
jest.mock('../logger')

// Create mock for logger before importing deployment_manager_local.js
const logDebug = jest.fn()
logger.create.mockImplementation(logId => {
  return { debug: logDebug }
})

const {
  status,
  DeploymentManager
} = require('../../../src/lib/deployment_manager/deployment_manager_local')

beforeEach(() => {
  jest.resetModules()
  jest.resetAllMocks()
})

test('DeploymentManager#get should return deployment info when status is READY', async () => {
  const docId = 'testdocid'
  const expectedResponse = { status: status.READY }
  deploymentModel.get.mockImplementation(async () => expectedResponse)
  const manager = new DeploymentManager()
  await expect(manager.get(docId)).resolves.toEqual(expectedResponse)
})

test('DeploymentManager#get should return deployment info when status is NOT_DEPLOYED', async () => {
  const docId = 'testdocid'
  const expectedResponse = { status: status.NOT_DEPLOYED }
  deploymentModel.get.mockImplementation(async () => expectedResponse)
  const manager = new DeploymentManager()
  await expect(manager.get(docId)).resolves.toEqual(expectedResponse)
})

test('DeploymentManager#get should return deployment info when status is PENDING', async () => {
  const docId = 'testdocid'
  const expectedResponse = { status: status.PENDING }
  deploymentModel.get.mockImplementation(async () => expectedResponse)
  const manager = new DeploymentManager()
  await expect(manager.get(docId)).resolves.toEqual(expectedResponse)
  expect(logDebug).toHaveBeenCalled()
})

test('DeploymentManager#get should return create deployment info when status is undefined', async () => {
  const docId = 'testdocid'
  const expectedResponse = { _id: docId, status: status.NOT_DEPLOYED }
  deploymentModel.get.mockImplementation(async () => { return {} })
  deploymentModel.create.mockImplementation(async (obj) => obj)
  const manager = new DeploymentManager()
  await expect(manager.get(docId)).resolves.toEqual(expectedResponse)
  expect(logDebug).toHaveBeenCalled()
})
