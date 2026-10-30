/**
 * dsh-plugin-custom-bg — Host half.
 *
 * Owns the wallpaper store (uploaded files + settings) and exposes it to the
 * browser half over same-origin HTTP routes under `/custom-bg/`:
 *
 *   GET  /custom-bg/api/state                current state (active image, list, settings)
 *   GET  /custom-bg/image/<id>.<ext>          image bytes (built-in default or upload)
 *   POST /custom-bg/api/upload                raw image body -> stored and activated
 *   POST /custom-bg/api/select                {"id": "..."} -> activate an existing image
 *   POST /custom-bg/api/delete                {"id": "..."} -> remove an uploaded image
 *   POST /custom-bg/api/settings              {"scrim": 0..0.85, "blur": 0..24}
 *
 * The browser half is `lib/client.js`; the package manifest points the DSH
 * client-module system at it through `dsh.client`.
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Stable Cordis plugin name; the bundle patch inserts a row with this id. */
export const name = 'custom-bg'

/** The Web server is the only service this plugin needs. */
export const inject = ['webServer']

/**
 * Route prefix claimed by this plugin. The Web server matches a prefix route
 * on the exact path or on `prefix + "/…"`, so it is registered without a
 * trailing slash.
 */
const ROUTE_PREFIX = '/custom-bg'

/** Id of the built-in background shipped inside the package. */
const DEFAULT_IMAGE = { id: 'default', ext: 'jpg', builtin: true, name: 'default.jpg' }

/** Extensions the store accepts, mapped to the response content type. */
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

/** Largest accepted upload body, in bytes. */
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024

/** Settings bounds, mirrored by the browser half's sliders. */
const LIMITS = { scrim: [0, 0.85], blur: [0, 24] }

/** Defaults used when the stored state has no settings yet. */
const DEFAULT_SETTINGS = { scrim: 0.45, blur: 6 }

/**
 * Resolve the Harness home with the documented precedence (explicit path,
 * `$DSH_HOME`, then `~/.dsh`). Vendored so the package needs no runtime
 * dependency it cannot resolve from a user profile.
 * @param configured - explicit home from plugin config.
 * @returns the absolute Harness home.
 */
function resolveDshHome(configured) {
  const fromEnv = process.env.DSH_HOME
  const selected =
    configured ?? (fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : join(homedir(), '.dsh'))
  return resolve(selected)
}

/**
 * Clamp one numeric setting into its accepted range.
 * @param value - candidate value.
 * @param bounds - inclusive [min, max].
 * @param fallback - value used when the candidate is not a finite number.
 * @returns the clamped number.
 */
function clampSetting(value, bounds, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(bounds[1], Math.max(bounds[0], value))
}

/**
 * Sniff an image signature so a mislabelled body never reaches the store.
 * @param buffer - the first bytes of the request body.
 * @returns the stored extension, or undefined when the bytes are not a supported image.
 */
function sniffExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buffer.length >= 6 && /^GIF8[79]a$/u.test(buffer.toString('ascii', 0, 6))) return 'gif'
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'avif'
  }
  return undefined
}

/**
 * Answer one request with JSON and no caching.
 * @param res - the response.
 * @param status - HTTP status.
 * @param body - JSON-serializable value.
 */
function sendJson(res, status, body) {
  const payload = Buffer.from(`${JSON.stringify(body)}\n`, 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(payload.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(payload)
}

/**
 * Reject requests a browser page on another origin could forge.
 *
 * The Web carrier's own `Host`/`Origin` policy belongs to the authenticated
 * `/api` bridge; routes registered here are plain, so they repeat the cheap
 * part of that policy themselves.
 * @param req - the request.
 * @returns whether the request may touch the store.
 */
function isTrustedRequest(req) {
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    try {
      if (new URL(origin).host !== host) return false
    } catch {
      return false
    }
  }
  return true
}

/**
 * Read a request body with a hard byte ceiling.
 * @param req - the request.
 * @param maxBytes - largest accepted body.
 * @returns the body, or a marker when the body exceeded the ceiling.
 */
async function readBody(req, maxBytes) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) return { tooLarge: true }
    chunks.push(chunk)
  }
  return { buffer: Buffer.concat(chunks) }
}

/**
 * Read and parse a small JSON request body.
 * @param req - the request.
 * @returns the parsed object, or undefined when the body is not a JSON object.
 */
async function readJson(req) {
  const body = await readBody(req, 64 * 1024)
  if (body.tooLarge || body.buffer === undefined || body.buffer.length === 0) return undefined
  try {
    const value = JSON.parse(body.buffer.toString('utf8'))
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Create the wallpaper store: files under `dataDir`, settings in `state.json`.
 * Every mutation is serialized so interleaved uploads cannot lose an entry.
 * @param dataDir - absolute directory owned by this plugin.
 * @param builtinPath - absolute path of the shipped default image.
 */
function createStore(dataDir, builtinPath) {
  const statePath = join(dataDir, 'state.json')
  let queue = Promise.resolve()
  /** @type {{ active?: string, images?: object[], settings?: object }} */
  let cache

  /** Read `state.json`, tolerating a missing or damaged file. */
  async function readState() {
    if (cache !== undefined) return cache
    try {
      const raw = await fs.readFile(statePath, 'utf8')
      const parsed = JSON.parse(raw)
      cache = typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      cache = {}
    }
    if (!Array.isArray(cache.images)) cache.images = []
    cache.settings = {
      scrim: clampSetting(cache.settings?.scrim, LIMITS.scrim, DEFAULT_SETTINGS.scrim),
      blur: clampSetting(cache.settings?.blur, LIMITS.blur, DEFAULT_SETTINGS.blur),
    }
    return cache
  }

  /** Persist the cached state atomically (write beside it, then rename). */
  async function writeState() {
    await fs.mkdir(dataDir, { recursive: true })
    const temporary = `${statePath}.${process.pid}.tmp`
    await fs.writeFile(temporary, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
    await fs.rename(temporary, statePath)
  }

  /** Run one mutation after every earlier mutation finished. */
  function mutate(operation) {
    const run = queue.then(async () => {
      await readState()
      const result = await operation(cache)
      await writeState()
      return result
    })
    queue = run.catch(() => {})
    return run
  }

  /** Public URL of one stored image, relative to the served page directory. */
  function imageUrl(id, ext) {
    return `custom-bg/image/${id}.${ext}`
  }

  /** Project the state into the shape the browser half consumes. */
  async function snapshot() {
    const state = await readState()
    const images = state.images.map((entry) => ({
      id: entry.id,
      ext: entry.ext,
      name: entry.name,
      size: entry.size,
      addedAt: entry.addedAt,
      builtin: false,
      url: imageUrl(entry.id, entry.ext),
    }))
    const all = [{ ...DEFAULT_IMAGE, url: imageUrl(DEFAULT_IMAGE.id, DEFAULT_IMAGE.ext) }, ...images]
    const active = all.find((entry) => entry.id === state.active) ?? all[0]
    return { version: 1, active, images: all, settings: { ...state.settings } }
  }

  /**
   * Store one uploaded image and make it active.
   * @param buffer - the image bytes.
   * @param originalName - the browser-supplied file name, kept for display only.
   */
  async function upload(buffer, originalName) {
    const ext = sniffExtension(buffer)
    if (ext === undefined) return { error: 'unsupported-image' }
    const id = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
    return mutate(async (state) => {
      const existing = state.images.find((entry) => entry.id === id && entry.ext === ext)
      if (existing === undefined) {
        await fs.mkdir(dataDir, { recursive: true })
        await fs.writeFile(join(dataDir, `${id}.${ext}`), buffer)
        state.images.unshift({
          id,
          ext,
          name: typeof originalName === 'string' && originalName.trim() !== '' ? originalName.trim().slice(0, 200) : `image.${ext}`,
          size: buffer.length,
          addedAt: Date.now(),
        })
      }
      state.active = id
      return { id }
    })
  }

  /** Activate an image that already exists. */
  async function select(id) {
    const state = await readState()
    const known = id === DEFAULT_IMAGE.id || state.images.some((entry) => entry.id === id)
    if (!known) return { error: 'unknown-image' }
    return mutate(async (draft) => {
      draft.active = id
      return { id }
    })
  }

  /** Delete one uploaded image; the built-in background cannot be deleted. */
  async function remove(id) {
    if (id === DEFAULT_IMAGE.id) return { error: 'builtin-image' }
    const state = await readState()
    const entry = state.images.find((candidate) => candidate.id === id)
    if (entry === undefined) return { error: 'unknown-image' }
    return mutate(async (draft) => {
      draft.images = draft.images.filter((candidate) => candidate.id !== id)
      if (draft.active === id) draft.active = DEFAULT_IMAGE.id
      await fs.rm(join(dataDir, `${entry.id}.${entry.ext}`), { force: true })
      return { id }
    })
  }

  /** Replace the two display settings. */
  async function updateSettings(patch) {
    return mutate(async (draft) => {
      if (patch.scrim !== undefined) draft.settings.scrim = clampSetting(patch.scrim, LIMITS.scrim, draft.settings.scrim)
      if (patch.blur !== undefined) draft.settings.blur = clampSetting(patch.blur, LIMITS.blur, draft.settings.blur)
      return { ...draft.settings }
    })
  }

  /**
   * Resolve one image request to bytes.
   * @param id - stored id.
   * @param ext - stored extension.
   * @returns the file path, or undefined when nothing matches.
   */
  async function imageFile(id, ext) {
    if (id === DEFAULT_IMAGE.id) return ext === DEFAULT_IMAGE.ext ? builtinPath : undefined
    const state = await readState()
    const entry = state.images.find((candidate) => candidate.id === id)
    if (entry === undefined || entry.ext !== ext) return undefined
    const file = join(dataDir, `${entry.id}.${entry.ext}`)
    try {
      await fs.access(file)
      return file
    } catch {
      return undefined
    }
  }

  return { snapshot, upload, select, remove, updateSettings, imageFile }
}

/**
 * Mount the plugin: claim the HTTP routes and serve the browser half from them.
 * @param ctx - Host plugin context.
 * @param config - optional `dshHome` and `dataDir` overrides.
 */
export function apply(ctx, config = {}) {
  const dataDir = config.dataDir ?? join(resolveDshHome(config.dshHome), 'plugin-data', 'dsh-custom-bg')
  const builtinPath = fileURLToPath(new URL('../imgs/default.jpg', import.meta.url))
  const store = createStore(dataDir, builtinPath)
  const imagePattern = /^([a-z0-9-]{2,40})\.(jpe?g|png|webp|gif|avif)$/u

  /**
   * Dispatch one request under the claimed prefix.
   * @param req - the request.
   * @param res - the response.
   */
  async function handle(req, res) {
    if (!isTrustedRequest(req)) {
      sendJson(res, 403, { error: 'forbidden' })
      return
    }
    const url = new URL(req.url ?? ROUTE_PREFIX, 'http://localhost')
    const path = url.pathname.startsWith(ROUTE_PREFIX)
      ? url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/u, '')
      : ''
    const method = (req.method ?? 'GET').toUpperCase()

    if (method === 'GET' && path === 'api/state') {
      sendJson(res, 200, await store.snapshot())
      return
    }

    if (method === 'GET' && path.startsWith('image/')) {
      const match = imagePattern.exec(path.slice('image/'.length))
      if (match === null) {
        sendJson(res, 404, { error: 'unknown-image' })
        return
      }
      const file = await store.imageFile(match[1], match[2])
      if (file === undefined) {
        sendJson(res, 404, { error: 'unknown-image' })
        return
      }
      const bytes = await fs.readFile(file)
      res.writeHead(200, {
        'content-type': MIME[match[2]] ?? 'application/octet-stream',
        'content-length': String(bytes.length),
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      })
      res.end(bytes)
      return
    }

    if (method === 'POST') {
      if (path === 'api/upload') {
        const body = await readBody(req, MAX_UPLOAD_BYTES)
        if (body.tooLarge) {
          sendJson(res, 413, { error: 'too-large' })
          return
        }
        const header = typeof req.headers['x-file-name'] === 'string' ? decodeURIComponent(req.headers['x-file-name']) : undefined
        const result = await store.upload(body.buffer ?? Buffer.alloc(0), header)
        if (result.error !== undefined) {
          sendJson(res, result.error === 'unsupported-image' ? 415 : 400, result)
          return
        }
        sendJson(res, 200, await store.snapshot())
        return
      }
      const patch = await readJson(req)
      if (patch === undefined) {
        sendJson(res, 400, { error: 'invalid-json' })
        return
      }
      if (path === 'api/select') {
        const result = await store.select(typeof patch.id === 'string' ? patch.id : '')
        if (result.error !== undefined) {
          sendJson(res, 404, result)
          return
        }
        sendJson(res, 200, await store.snapshot())
        return
      }
      if (path === 'api/delete') {
        const result = await store.remove(typeof patch.id === 'string' ? patch.id : '')
        if (result.error !== undefined) {
          sendJson(res, result.error === 'unknown-image' ? 404 : 400, result)
          return
        }
        sendJson(res, 200, await store.snapshot())
        return
      }
      if (path === 'api/settings') {
        await store.updateSettings(patch)
        sendJson(res, 200, await store.snapshot())
        return
      }
    }

    sendJson(res, 404, { error: 'not-found' })
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (req, res) => {
          try {
            await handle(req, res)
          } catch (error) {
            ctx.logger?.warn?.(`custom-bg: ${error instanceof Error ? error.message : String(error)}`)
            if (!res.headersSent) sendJson(res, 500, { error: 'internal' })
            else res.destroy()
          }
        },
      }),
    'custom-bg: wallpaper routes',
  )
}
