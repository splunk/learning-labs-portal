'use strict'

const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const os = require('os')

exports.getImageIdByContainerId = async function (containerId) {
  const cmd = `docker inspect ${containerId} -f "{{.Image}}"`
  try {
    const res = await exec(cmd)
    return res.stdout.split(os.EOL)[0]
  } catch (err) {
    const message = `Failed to get Docker Image for Container ID ${containerId}`
    const error = new Error(message)
    error.original = err
    throw error
  }
}

exports.stopContainer = async function (containerId) {
  try {
    const cmd = `docker stop -t 5 ${containerId}`
    await exec(cmd)
  } catch (err) {
    const message = `Failed to stop container ${containerId}`
    const error = new Error(message)
    error.original = err
    throw error
  }
}

exports.getImageDigestByContainerId = async function (containerId) {
  try {
    const imageId = await exports.getImageIdByContainerId(containerId)
    const cmd = `docker image inspect ${imageId} -f "{{index .RepoDigests 0 }}"`
    const res = await exec(cmd)
    return res.stdout.split(os.EOL)[0].split('@')[1]
  } catch (err) {
    const message = `Failed to get Docker Image Digest for Container ID ${containerId}`
    const error = new Error(message)
    error.original = err
    throw error
  }
}

exports.getImageDigestByImageId = async function (imageId) {
  try {
    const cmd = `docker image inspect ${imageId} -f "{{index .RepoDigests 0 }}"`
    const res = await exec(cmd)
    return res.stdout.split(os.EOL)[0].split('@')[1]
  } catch (err) {
    const message = `Failed to get Docker Image Digest for Image ID ${imageId}`
    const error = new Error(message)
    error.original = err
    throw error
  }
}

exports.pullImageByDigest = async function (image, digest) {
  try {
    const cmd = `docker pull ${image}@${digest}`
    await exec(cmd)
  } catch (err) {
    const message = `Failed to pull Docker Image for ${image}@${digest}`
    const error = new Error(message)
    error.original = err
    throw error
  }
}

exports.localImageExists = async function (image, digest) {
  try {
    const cmd = "docker image ls --digests | awk '{ print $1 $3 }'"
    const result = await exec(cmd)
    return result.stdout.split('\n').includes(`${image}${digest}`)
  } catch (err) {
    return false
  }
}
