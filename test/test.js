const got = require('got')
const { readFile, pathExists } = require('fs-extra')

const username = process.env.WORKSHOP_USERNAME || 'admin'
const passwordPath = process.env.WORKSHOP_PASSWORD
const baseUrl = process.env.URL

if (!passwordPath) {
  console.log('Missing environment variable "WORKSHOP_PASSWORD"')
  process.exit(1)
}
if (!baseUrl) {
  console.log('Missing environment variable "URL"')
  process.exit(1)
}

async function getCatalog () {
  const url = `${baseUrl}/api/catalog`
  const options = {
    url: url,
    responseType: 'json'
  }
  console.log(`Getting catalog from ${url}`)
  const result = await got.get(options)
  console.log('Successfully retrieved catalogs')
  return result.body.data
}

async function login () {
  console.log(`Reading password from ${passwordPath}`)
  const url = `${baseUrl}/api/auth`
  if (!pathExists(passwordPath)) {
    throw new Error(`password file does not exist at ${passwordPath}`)
  }
  const password = (await readFile(passwordPath)).toString().trim()
  const options = {
    json: { username, password },
    responseType: 'json'
  }
  try {
    console.log(`Creating an access token from ${url}`)
    const response = await got.post(url, options)
    console.log('Successfully created an access token')
    return response.body.data.token
  } catch (e) {
    console.log('Failed to create an access token')
    console.log(e.message)
    throw e
  }
}

async function checkDocs (catalog, token) {
  for (let item of catalog) {
    const url = `${baseUrl}/doc/${item._id}/`
    console.log(`Testing ${url}`)
    const options = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
    try {
      const response = await got.get(url, options)
      if (response.statusCode === 200) {
        console.log(`Workshop ${item.title} (ID: ${item._id}) is responsive`)
      } else {
        const message = `Received unexpected status code: ${response.statusCode}`
        const err = new Error(message)
        err.body = response.body
        throw err
      }
    } catch (err) {
      const message = `Received StatusCode ${err.statusCode} for url ${url}`
      err = new Error(message)
      err.body = response.body
      throw err
    }
    console.log(`Successfully accessed workshop at ${url}`)
  }
}

async function test () {
  const catalog = await getCatalog(baseUrl)
  const token = await login()
  await checkDocs(catalog, token)
}

test()
  .then(() => console.log('done'))
  .catch(err => {
    console.log(err.message)
    if (err.body) {
      console.log(err.body)
    }
    process.exit(1)
  })
