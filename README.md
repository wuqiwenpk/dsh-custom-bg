# dsh-plugin-custom-bg · Custom wallpaper

English | [中文](README.zh.md)

A wallpaper for DeepSeek Harness. A small floating panel in the bottom-left
corner uploads images, switches between them, and tunes the scrim and blur. The
default background ships inside the package (`imgs/default.jpg`), so the plugin
has something to show the moment it is enabled.

![Floating panel](docs/panel.png)

## Features

- **Bottom-left floating panel** — a 44px button that expands into a 312px card; it never takes layout space.
- **Bundled default background** — `imgs/default.jpg` is served straight from the package, no network needed.
- **Upload and apply** — pick a file or drop an image onto the panel. JPG, PNG, WebP, GIF and AVIF up to 24 MB.
- **Keep several images** — every upload stays as a thumbnail; click to switch, hover to delete. Re-uploading the same bytes stores it once.
- **Scrim and blur** — two sliders keep text readable: scrim 0–85%, blur 0–24px.
- **Follows light and dark** — the scrim flips between white and black with the theme, and the panel itself is themed glass.
- **Persists across reloads** — the active image and both sliders live in `$DSH_HOME/plugin-data/dsh-custom-bg/state.json`.
- **No third-party runtime** — the Host half uses Node built-ins only; the browser half is plain DOM.

![Dark theme](docs/panel-dark.png)

## Install

### Plugin market (recommended)

Open **Plugins → Plugin market**, search `custom-bg`, and install. Reload the
page once; the wallpaper button appears in the bottom-left corner.

The listing material lives in [`market/`](market/README.md): `index.json` is a
format-1 market index you can add as a Discover index source today, and
`awesome-dsh-plugin.yml` is the single file to submit to the curated catalog.

### Command line

```sh
dsh plugin --profile web add dsh-plugin-custom-bg
```

Replace `web` with the profile your host boots, then restart `dsh web`.

### Straight from GitHub

```sh
dsh plugin --profile web add "git+https://github.com/wuqiwenpk/dsh-custom-bg.git"
```

## Usage

1. Click the wallpaper button in the bottom-left corner.
2. **Upload** — press “上传图片” or drop an image onto the panel. The upload becomes the active background immediately.
3. **Switch** — click a thumbnail. The one labelled 默认 is the bundled background.
4. **Tune** — drag 遮罩 to dim or lift the wallpaper, drag 模糊 to push it back.
5. **Reset** — “恢复默认” returns to `default.jpg`.
6. **Collapse** — the × in the header, or `Esc`; the panel remembers whether it was open.

## Data and configuration

| Item | Location |
|---|---|
| Uploaded images | `$DSH_HOME/plugin-data/dsh-custom-bg/<id>.<ext>` |
| Active image and sliders | `$DSH_HOME/plugin-data/dsh-custom-bg/state.json` |
| Bundled default | `imgs/default.jpg` inside the package |

`$DSH_HOME` defaults to `~/.dsh`. Uninstalling keeps this data; delete the
directory to remove it.

Two optional config fields, in the profile's `cordis.patch.yml`:

```yaml
- id: custom-bg
  config:
    dataDir: D:/my-data/custom-bg   # override the data directory
    dshHome: D:/my-dsh-home         # override the $DSH_HOME inference
```

## HTTP routes

The Host half claims the `/custom-bg` prefix:

| Method | Path | Purpose |
|---|---|---|
| GET | `/custom-bg/api/state` | Active image, image list, scrim and blur |
| GET | `/custom-bg/image/<id>.<ext>` | Image bytes, long-lived cache |
| POST | `/custom-bg/api/upload` | Raw image body (optional `x-file-name`); stored and activated |
| POST | `/custom-bg/api/select` | `{"id": "..."}` |
| POST | `/custom-bg/api/delete` | `{"id": "..."}`; the bundled background is not deletable |
| POST | `/custom-bg/api/settings` | `{"scrim": 0..0.85, "blur": 0..24}`, clamped |

Cross-site requests are refused (`Sec-Fetch-Site` / `Origin`), and uploads are
sniffed by signature — mislabelled bodies get 415.

## Compatibility

- DSH `0.2.x` on the `web` carrier (`@deepseek-ai/dsh-host-webserver` plus the client-module system).
- The shell-owned `file://` carrier is out of scope; the desktop app works because it runs a local `dsh web`.

## Troubleshooting

- **No wallpaper appears** — another theme/appearance plugin may be writing `--dsw-alias-bg-base` back; keep one of them enabled.
- **Why the panel sits 82px above the bottom edge** — so it clears the sidebar's footer row (settings, more, account) instead of covering it.
- **Upload rejected** — formats are checked by file signature, so a renamed file gets 415; the limit is 24 MB.
- **Start clean** — delete `$DSH_HOME/plugin-data/dsh-custom-bg/` and the bundled default comes back.

## Development

`lib/` is the source — there is no build step. `lib/index.js` is the Host half;
`lib/client.js` is the browser bundle with its `window.__ModuleLoader__`
envelope.

```sh
npm run check   # syntax check both halves
npm run smoke   # offline Host smoke test against a temp directory

dsh --profile cb-test --from-default-profile web --dump-config
dsh plugin --profile cb-test add link:$PWD
dsh --profile cb-test web --port 43301
```

## License

MIT
