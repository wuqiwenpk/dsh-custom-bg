/**
 * Offline smoke test for the Host half.
 *
 * It mounts the plugin against a fake Cordis context whose `webServer` records
 * the route, then drives that route with mock requests. No Harness process, no
 * browser, and the store lives in a throwaway directory under the OS temp dir.
 *
 *   node scripts/smoke.mjs
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

/** 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** Build a request the route handler can iterate. */
function request(method, path, { body, headers = {} } = {}) {
  const chunks = body === undefined ? [] : [Buffer.from(body)]
  return {
    method,
    url: path,
    headers: { host: '127.0.0.1:43129', 'sec-fetch-site': 'same-origin', ...headers },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

/** Build a response that records what the handler wrote. */
function response() {
  return {
    status: 0,
    headers: {},
    body: Buffer.alloc(0),
    headersSent: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
      this.headersSent = true
    },
    end(body) {
      this.body = body === undefined ? Buffer.alloc(0) : Buffer.from(body)
    },
    destroy() {},
  }
}

/** Mount the plugin and return the registered route plus a dispatcher. */
async function mount(dataDir) {
  let route
  const disposers = []
  const ctx = {
    webServer: {
      register(candidate) {
        route = candidate
        return () => {}
      },
    },
    effect(factory) {
      disposers.push(factory())
    },
    logger: { warn() {} },
  }
  apply(ctx, { dataDir })
  assert.equal(route?.kind, 'prefix')
  assert.equal(route?.path, '/custom-bg')
  return async (method, path, options) => {
    const res = response()
    await route.handler(request(method, path, options), res)
    return res
  }
}

/** Parse a JSON response body. */
function json(res) {
  return JSON.parse(res.body.toString('utf8'))
}

const dataDir = await mkdtemp(join(tmpdir(), 'dsh-custom-bg-'))
try {
  const call = await mount(dataDir)

  const initial = json(await call('GET', '/custom-bg/api/state'))
  assert.equal(initial.active.id, 'default')
  assert.deepEqual(
    initial.images.map((entry) => entry.id),
    ['default', 'ducks', 'seaside'],
    'the three bundled wallpapers are listed first',
  )
  assert.ok(
    initial.images.every((entry) => entry.builtin === true),
    'bundled wallpapers are flagged builtin',
  )
  assert.equal(initial.settings.scrim, 0.45)

  for (const name of ['default.jpg', 'ducks.jpg', 'seaside.jpg']) {
    const builtin = await call('GET', `/custom-bg/image/${name}`)
    assert.equal(builtin.status, 200, `${name} must be served`)
    assert.equal(builtin.headers['content-type'], 'image/jpeg')
    assert.ok(builtin.body.length > 1000, `shipped ${name} must not be empty`)
  }

  const shipped = await call('POST', '/custom-bg/api/delete', {
    body: JSON.stringify({ id: 'ducks' }),
    headers: { 'content-type': 'application/json' },
  })
  assert.equal(shipped.status, 400)
  assert.equal(json(shipped).error, 'builtin-image')

  const uploaded = await call('POST', '/custom-bg/api/upload', {
    body: PNG,
    headers: { 'content-type': 'image/png', 'x-file-name': encodeURIComponent('我的壁纸.png') },
  })
  assert.equal(uploaded.status, 200)
  const afterUpload = json(uploaded)
  assert.equal(afterUpload.active.builtin, false)
  assert.equal(afterUpload.images.length, 4)
  assert.equal(afterUpload.images[3].name, '我的壁纸.png')

  const image = await call('GET', `/custom-bg/image/${afterUpload.active.id}.png`)
  assert.equal(image.status, 200)
  assert.equal(image.headers['content-type'], 'image/png')
  assert.deepEqual(image.body, PNG)

  const settings = await call('POST', '/custom-bg/api/settings', {
    body: JSON.stringify({ scrim: 9, blur: 11 }),
    headers: { 'content-type': 'application/json' },
  })
  assert.deepEqual(json(settings).settings, { scrim: 0.85, blur: 11 }, 'settings clamp to their ranges')

  const restored = await call('POST', '/custom-bg/api/select', {
    body: JSON.stringify({ id: 'default' }),
    headers: { 'content-type': 'application/json' },
  })
  assert.equal(json(restored).active.id, 'default')

  const deleted = await call('POST', '/custom-bg/api/delete', {
    body: JSON.stringify({ id: afterUpload.active.id }),
    headers: { 'content-type': 'application/json' },
  })
  assert.equal(json(deleted).images.length, 3)

  const missing = await call('GET', '/custom-bg/image/nonexistent.png')
  assert.equal(missing.status, 404)

  const rejected = await call('POST', '/custom-bg/api/upload', {
    body: Buffer.from('not an image'),
    headers: { 'content-type': 'image/png' },
  })
  assert.equal(rejected.status, 415)

  const forbidden = await call('POST', '/custom-bg/api/settings', {
    body: JSON.stringify({ scrim: 0 }),
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  })
  assert.equal(forbidden.status, 403)

  console.log('custom-bg smoke: ok')
} finally {
  await rm(dataDir, { recursive: true, force: true })
}
