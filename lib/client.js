/**
 * dsh-plugin-custom-bg — Browser half.
 *
 * Draws the wallpaper layer behind the shell and a small floating panel in the
 * bottom-left corner that uploads, selects, and tunes background images. The
 * Host half (`lib/index.js`) owns the files; this module only talks to it over
 * same-origin `custom-bg/…` routes resolved against `document.baseURI`, so a
 * deployment mounted under a path prefix keeps working.
 *
 * The bundle is wrapped in the DSH client-module envelope: executing it only
 * registers the factory, and `apply(ctx)` runs when the plugin row activates.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-custom-bg',
  factory: () => {
    var module = { exports: {} }
    var exports = module.exports

    /** Services this plugin needs from the client context; none beyond `ctx` itself. */
    const inject = []

    /** Element ids owned by this module, used to stay idempotent across HMR. */
    const ROOT_ID = 'dsh-custom-bg-root'
    const STYLE_ID = 'dsh-custom-bg-style'
    const WALL_ID = 'dsh-custom-bg-wallpaper'
    const SCRIM_ID = 'dsh-custom-bg-scrim'
    const OPEN_KEY = 'dsh-custom-bg:open'

    const CSS = String.raw`
#${WALL_ID}{position:fixed;inset:0;z-index:-1;background-position:center;background-size:cover;background-repeat:no-repeat;
  transition:filter .18s ease,opacity .25s ease;pointer-events:none;will-change:filter}
#${SCRIM_ID}{position:absolute;inset:0;transition:background-color .18s ease}
html,body{background-color:transparent!important}
body{--dsw-alias-bg-base:transparent!important}
body:not([data-ds-dark-theme]){--cbg-surface:#ffffff;--cbg-surface-a:.78;--cbg-border:rgba(0,0,0,.10);--cbg-label:#1b1b1c;--cbg-label-dim:#61666b}
body[data-ds-dark-theme]{--cbg-surface:#1b1b1c;--cbg-surface-a:.74;--cbg-border:rgba(255,255,255,.14);--cbg-label:#f2f3f5;--cbg-label-dim:#adb2b8}
body:not([data-ds-dark-theme]){--dsw-specific-sidebar-fill:rgba(249,250,251,var(--cbg-sidebar-a,.72))!important}
body[data-ds-dark-theme]{--dsw-specific-sidebar-fill:rgba(21,21,23,var(--cbg-sidebar-a,.62))!important}
#${ROOT_ID}{position:fixed;left:16px;bottom:82px;z-index:2147483000;font-family:inherit;pointer-events:none;
  font-size:13px;line-height:1.45;color:var(--cbg-label)}
#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID} .cbg-bubble{pointer-events:auto;display:flex;align-items:center;justify-content:center;width:44px;height:44px;
  border-radius:50%;border:1px solid var(--cbg-border);background:color-mix(in srgb,var(--cbg-surface) calc(var(--cbg-surface-a)*100%),transparent);
  color:var(--cbg-label);cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);backdrop-filter:blur(18px) saturate(1.2);
  transition:transform .15s ease,background .15s ease;padding:0}
#${ROOT_ID} .cbg-bubble:hover{transform:translateY(-1px)}
#${ROOT_ID} .cbg-bubble:focus-visible{outline:2px solid #4d93f8;outline-offset:2px}
#${ROOT_ID}[data-open='true'] .cbg-bubble{display:none}
#${ROOT_ID} .cbg-panel{pointer-events:auto;display:none;flex-direction:column;width:312px;max-width:calc(100vw - 32px);max-height:min(70vh,560px);
  border-radius:16px;border:1px solid var(--cbg-border);overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.28);
  background:color-mix(in srgb,var(--cbg-surface) calc(var(--cbg-surface-a)*100%),transparent);
  backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3)}
#${ROOT_ID}[data-open='true'] .cbg-panel{display:flex}
#${ROOT_ID} .cbg-head{display:flex;align-items:center;gap:8px;padding:12px 14px 10px}
#${ROOT_ID} .cbg-title{font-size:13px;font-weight:600;letter-spacing:.01em;flex:1}
#${ROOT_ID} .cbg-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;
  border-radius:8px;border:0;background:transparent;color:var(--cbg-label-dim);cursor:pointer;font-size:16px;line-height:1}
#${ROOT_ID} .cbg-icon-btn:hover{background:rgba(127,130,135,.16);color:var(--cbg-label)}
#${ROOT_ID} .cbg-body{padding:0 14px 4px;overflow:auto;display:flex;flex-direction:column;gap:12px}
#${ROOT_ID} .cbg-drop{display:flex;flex-direction:column;gap:6px;border:1px dashed var(--cbg-border);border-radius:12px;
  padding:12px;text-align:center;transition:border-color .15s ease,background .15s ease}
#${ROOT_ID} .cbg-drop[data-over='true']{border-color:#4d93f8;background:rgba(77,147,248,.12)}
#${ROOT_ID} .cbg-upload{pointer-events:auto;align-self:center;border-radius:9px;border:1px solid var(--cbg-border);
  background:rgba(127,130,135,.14);color:var(--cbg-label);font:inherit;font-size:12.5px;padding:7px 14px;cursor:pointer}
#${ROOT_ID} .cbg-upload:hover{background:rgba(127,130,135,.24)}
#${ROOT_ID} .cbg-upload:disabled{opacity:.55;cursor:default}
#${ROOT_ID} .cbg-hint{font-size:11.5px;color:var(--cbg-label-dim)}
#${ROOT_ID} .cbg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#${ROOT_ID} .cbg-thumb{position:relative;padding:0;height:54px;border-radius:10px;border:2px solid transparent;cursor:pointer;
  background-color:rgba(127,130,135,.16);background-position:center;background-size:cover;overflow:hidden;
  transition:border-color .15s ease,transform .15s ease}
#${ROOT_ID} .cbg-thumb:hover{transform:translateY(-1px)}
#${ROOT_ID} .cbg-thumb[data-active='true']{border-color:#4d93f8;box-shadow:0 0 0 2px rgba(77,147,248,.28)}
#${ROOT_ID} .cbg-thumb .cbg-del{position:absolute;top:2px;right:2px;display:none;align-items:center;justify-content:center;
  width:18px;height:18px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:12px;line-height:1;cursor:pointer;padding:0}
#${ROOT_ID} .cbg-thumb:hover .cbg-del{display:flex}
#${ROOT_ID} .cbg-badge{position:absolute;left:3px;bottom:3px;font-size:9.5px;padding:1px 4px;border-radius:4px;
  background:rgba(0,0,0,.55);color:#fff;letter-spacing:.02em}
#${ROOT_ID} .cbg-row{display:flex;align-items:center;gap:10px;font-size:12px}
#${ROOT_ID} .cbg-row label{width:30px;color:var(--cbg-label-dim);flex:none}
#${ROOT_ID} .cbg-row input[type=range]{flex:1;min-width:0;accent-color:#4d93f8;height:18px;cursor:pointer}
#${ROOT_ID} .cbg-row output{width:38px;text-align:right;font-variant-numeric:tabular-nums;color:var(--cbg-label-dim)}
#${ROOT_ID} .cbg-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px 12px;
  border-top:1px solid var(--cbg-border);margin-top:10px}
#${ROOT_ID} .cbg-link{border:0;background:transparent;color:var(--cbg-label-dim);font:inherit;font-size:12px;cursor:pointer;padding:0}
#${ROOT_ID} .cbg-link:hover{color:var(--cbg-label);text-decoration:underline}
#${ROOT_ID} .cbg-status{font-size:11.5px;color:var(--cbg-label-dim);min-height:1em;flex:1;text-align:right;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (prefers-reduced-motion:reduce){#${ROOT_ID} *{transition:none!important}}
`

    /** Resolve one plugin-relative path against the page directory. */
    function api(path) {
      const relative = String(path).replace(/^\/+/u, '')
      if (typeof document === 'undefined') return `/${relative}`
      return new URL(relative, document.baseURI).pathname
    }

    /** Absolute URL for one image path returned by the Host. */
    function imageHref(path) {
      return new URL(String(path).replace(/^\/+/u, ''), document.baseURI).href
    }

    /** Whether the shell currently renders the dark palette. */
    function isDark() {
      return document.body?.hasAttribute('data-ds-dark-theme') === true
    }

    /** Wallpaper scrim color for the current palette and opacity setting. */
    function scrimColor(opacity) {
      const alpha = Math.min(0.85, Math.max(0, Number(opacity) || 0))
      return isDark() ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`
    }

    /**
     * Opacity of the sidebar / title-bar fill for a given scrim. At scrim 0 the
     * shell steps aside so the wallpaper reads at full strength; the more scrim
     * the user adds for legibility, the more the shell covers the image again.
     */
    function sidebarAlpha(scrim) {
      const value = Math.min(0.85, Math.max(0, Number(scrim) || 0))
      return Number((0.15 + value * 0.78).toFixed(3))
    }

    /** Build one element with attributes and children. */
    function el(tag, attributes = {}, children = []) {
      const node = document.createElement(tag)
      for (const [key, value] of Object.entries(attributes)) {
        if (value === undefined || value === null || value === false) continue
        if (key === 'text') node.textContent = String(value)
        else if (key === 'class') node.className = String(value)
        else if (key === 'dataset') Object.assign(node.dataset, value)
        else node.setAttribute(key, String(value))
      }
      for (const child of children) if (child !== undefined && child !== null) node.append(child)
      return node
    }

    /**
     * Mount the wallpaper layer and the floating panel.
     * @param ctx - client plugin context.
     * @returns disposer removing every node, listener, and in-flight request.
     */
    function mount(ctx) {
      const controller = new AbortController()
      const wallpaper = el('div', { id: WALL_ID })
      const scrim = el('div', { id: SCRIM_ID })
      wallpaper.append(scrim)

      const style = el('style', { id: STYLE_ID, 'data-plugin': 'dsh-plugin-custom-bg', text: CSS })
      document.getElementById(STYLE_ID)?.remove()
      document.getElementById(ROOT_ID)?.remove()
      document.head.append(style)

      /** @type {{active?: object, images?: object[], settings?: {scrim:number, blur:number}}} */
      let state = { images: [], settings: { scrim: 0.45, blur: 6 } }
      let busy = false

      const uploadInput = el('input', { type: 'file', accept: 'image/*', hidden: 'hidden' })
      const uploadButton = el('button', { class: 'cbg-upload', type: 'button', text: '上传图片' })
      const hint = el('span', { class: 'cbg-hint', text: '或将图片拖到这里 · JPG/PNG/WebP/GIF/AVIF' })
      const drop = el('div', { class: 'cbg-drop' }, [uploadButton, hint, uploadInput])
      const grid = el('div', { class: 'cbg-grid' })

      const scrimRange = el('input', { type: 'range', min: '0', max: '85', step: '5', 'aria-label': '遮罩' })
      const scrimOut = el('output', { text: '45%' })
      const blurRange = el('input', { type: 'range', min: '0', max: '24', step: '1', 'aria-label': '模糊' })
      const blurOut = el('output', { text: '6px' })

      const status = el('span', { class: 'cbg-status' })
      const resetButton = el('button', { class: 'cbg-link', type: 'button', text: '恢复默认' })
      const closeButton = el('button', { class: 'cbg-icon-btn', type: 'button', title: '收起', 'aria-label': '收起', text: '×' })
      const bubble = el('button', {
        class: 'cbg-bubble',
        type: 'button',
        title: '自定义背景',
        'aria-label': '自定义背景',
      })
      // A tiny inline glyph keeps the bundle dependency-free.
      bubble.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="4" width="18" height="16" rx="3"></rect>' +
        '<circle cx="8.5" cy="9.5" r="1.6"></circle>' +
        '<path d="M21 16l-4.6-4.6a2 2 0 0 0-2.8 0L5 20"></path></svg>'

      const panel = el('div', { class: 'cbg-panel', role: 'dialog', 'aria-label': '自定义背景' }, [
        el('div', { class: 'cbg-head' }, [el('span', { class: 'cbg-title', text: '自定义背景' }), closeButton]),
        el('div', { class: 'cbg-body' }, [
          drop,
          grid,
          el('div', { class: 'cbg-row' }, [el('label', { text: '遮罩' }), scrimRange, scrimOut]),
          el('div', { class: 'cbg-row' }, [el('label', { text: '模糊' }), blurRange, blurOut]),
        ]),
        el('div', { class: 'cbg-foot' }, [resetButton, status]),
      ])

      const root = el('div', { id: ROOT_ID, dataset: { open: 'false' } }, [bubble, panel])
      document.body.append(wallpaper)
      document.body.append(root)

      /** Reflect the current state onto the wallpaper layer and controls. */
      function render() {
        const settings = state.settings ?? { scrim: 0.45, blur: 6 }
        const active = state.active
        if (active?.url !== undefined) wallpaper.style.backgroundImage = `url("${imageHref(active.url)}")`
        else wallpaper.style.backgroundImage = 'none'
        wallpaper.style.filter = settings.blur > 0 ? `blur(${settings.blur}px)` : 'none'
        wallpaper.style.transform = settings.blur > 0 ? `scale(${1 + settings.blur * 0.012})` : 'none'
        scrim.style.backgroundColor = scrimColor(settings.scrim)
        // The sidebar and the title bar paint the same translucent fill; let it
        // follow the scrim so pushing the slider to 0 reveals the wallpaper
        // everywhere, not just behind the chat column.
        document.body.style.setProperty('--cbg-sidebar-a', String(sidebarAlpha(settings.scrim)))
        scrimRange.value = String(Math.round(settings.scrim * 100))
        scrimOut.textContent = `${Math.round(settings.scrim * 100)}%`
        blurRange.value = String(Math.round(settings.blur))
        blurOut.textContent = `${Math.round(settings.blur)}px`
        renderGrid(active)
      }

      /** Rebuild the thumbnail strip. */
      function renderGrid(active) {
        grid.replaceChildren()
        for (const image of state.images ?? []) {
          const thumb = el('button', {
            class: 'cbg-thumb',
            type: 'button',
            title: image.builtin ? '默认背景' : image.name ?? image.id,
            'aria-label': image.builtin ? '默认背景' : image.name ?? image.id,
            dataset: { active: String(active?.id === image.id) },
          })
          if (image.url !== undefined) thumb.style.backgroundImage = `url("${imageHref(image.url)}")`
          if (image.builtin === true) thumb.append(el('span', { class: 'cbg-badge', text: '默认' }))
          else {
            const remove = el('button', {
              class: 'cbg-del',
              type: 'button',
              title: '删除',
              'aria-label': `删除 ${image.name ?? image.id}`,
              text: '×',
            })
            remove.addEventListener('click', (event) => {
              event.stopPropagation()
              void mutate('api/delete', { id: image.id }, '已删除')
            })
            thumb.append(remove)
          }
          thumb.addEventListener('click', () => {
            if (active?.id === image.id) return
            void mutate('api/select', { id: image.id }, '已切换背景')
          })
          grid.append(thumb)
        }
      }

      /** Show a short status line inside the panel. */
      function setStatus(text) {
        status.textContent = text
      }

      /** Fetch the whole state from the Host. */
      async function refresh() {
        try {
          const response = await fetch(api('custom-bg/api/state'), {
            cache: 'no-store',
            signal: controller.signal,
            credentials: 'same-origin',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const next = await response.json()
          state = next
          render()
          setStatus('')
        } catch (error) {
          if (controller.signal.aborted) return
          setStatus('背景服务不可用')
          ctx.logger?.warn?.(`custom-bg: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      /** POST one mutation and adopt the returned state. */
      async function mutate(path, body, message) {
        if (busy) return
        busy = true
        setStatus('处理中…')
        try {
          const response = await fetch(api(`custom-bg/${path}`), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
            credentials: 'same-origin',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          state = await response.json()
          render()
          setStatus(message)
        } catch (error) {
          if (!controller.signal.aborted) setStatus('操作失败，请重试')
        } finally {
          busy = false
        }
      }

      /** Upload one file and activate it. */
      async function upload(file) {
        if (file === undefined || busy) return
        if (!String(file.type).startsWith('image/')) {
          setStatus('请选择图片文件')
          return
        }
        busy = true
        uploadButton.disabled = true
        setStatus('上传中…')
        try {
          const response = await fetch(api('custom-bg/api/upload'), {
            method: 'POST',
            headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) },
            body: file,
            signal: controller.signal,
            credentials: 'same-origin',
          })
          if (!response.ok) {
            const failure = await response.json().catch(() => ({}))
            throw new Error(failure.error ?? `HTTP ${response.status}`)
          }
          state = await response.json()
          render()
          setStatus('背景已更新')
        } catch (error) {
          if (!controller.signal.aborted) setStatus(error?.message === 'too-large' ? '图片太大（上限 24MB）' : '上传失败，请重试')
        } finally {
          busy = false
          uploadButton.disabled = false
          uploadInput.value = ''
        }
      }

      /** Open or close the panel, persisting the choice for the next page load. */
      function setOpen(open) {
        root.dataset.open = String(open)
        try {
          window.localStorage.setItem(OPEN_KEY, open ? '1' : '0')
        } catch {
          /* storage may be disabled; the panel still works for this page */
        }
        if (open) void refresh()
      }

      bubble.addEventListener('click', () => setOpen(true))
      closeButton.addEventListener('click', () => setOpen(false))
      uploadButton.addEventListener('click', () => uploadInput.click())
      uploadInput.addEventListener('change', () => void upload(uploadInput.files?.[0]))
      resetButton.addEventListener('click', () => {
        const builtin = (state.images ?? []).find((image) => image.builtin === true)
        if (builtin !== undefined) void mutate('api/select', { id: builtin.id }, '已恢复默认背景')
      })

      let settingsTimer
      /** Debounce a settings write while the user drags a slider. */
      function pushSettings() {
        const settings = { scrim: Number(scrimRange.value) / 100, blur: Number(blurRange.value) }
        state.settings = settings
        render()
        clearTimeout(settingsTimer)
        settingsTimer = setTimeout(() => {
          void mutate('api/settings', settings, '')
        }, 180)
      }
      scrimRange.addEventListener('input', pushSettings)
      blurRange.addEventListener('input', pushSettings)

      const onDragOver = (event) => {
        event.preventDefault()
        drop.dataset.over = 'true'
      }
      const onDragLeave = () => {
        drop.dataset.over = 'false'
      }
      const onDrop = (event) => {
        event.preventDefault()
        drop.dataset.over = 'false'
        const file = event.dataTransfer?.files?.[0]
        if (file !== undefined) void upload(file)
      }
      const onKeyDown = (event) => {
        if (event.key === 'Escape' && root.dataset.open === 'true') {
          event.stopPropagation()
          setOpen(false)
        }
      }
      panel.addEventListener('dragover', onDragOver)
      panel.addEventListener('dragleave', onDragLeave)
      panel.addEventListener('drop', onDrop)
      // Dropping anywhere else must not navigate the page away.
      const swallowWindowDrop = (event) => {
        if (drop.contains(event.target)) return
        event.preventDefault()
      }
      window.addEventListener('dragover', swallowWindowDrop)
      window.addEventListener('drop', swallowWindowDrop)
      document.addEventListener('keydown', onKeyDown, true)

      // The palette can flip at any time; keep the scrim legible in both.
      const observer = new MutationObserver(() => render())
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

      let open = false
      try {
        open = window.localStorage.getItem(OPEN_KEY) === '1'
      } catch {
        open = false
      }
      setOpen(open)
      void refresh()

      return () => {
        controller.abort()
        clearTimeout(settingsTimer)
        observer.disconnect()
        document.removeEventListener('keydown', onKeyDown, true)
        window.removeEventListener('dragover', swallowWindowDrop)
        window.removeEventListener('drop', swallowWindowDrop)
        wallpaper.remove()
        root.remove()
        style.remove()
      }
    }

    /**
     * Activate the plugin for one client fiber.
     * @param ctx - client plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => mount(ctx), 'custom-bg: wallpaper + floating panel')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
