/**
 * Regenerate `market/index.json` — the plugin market index (format 1) that
 * ships with this repository, so the plugin can be found by adding the file as
 * an index source in DSH's Discover tab.
 *
 * The pinned Git commit must already be reachable on GitHub, or installing from
 * the index fails: it is `--ref` when given, otherwise the local HEAD.
 *
 *   node scripts/build-index.mjs                 # pin HEAD (push it first)
 *   node scripts/build-index.mjs --ref 6b7234b   # pin an existing commit
 *
 * Format: `@deepseek-ai/dsh-plugin-market-index` (`format: 1`).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const icon = readFileSync(join(root, 'docs/icon.svg'))
const refFlag = process.argv.indexOf('--ref')
const commit =
  refFlag === -1
    ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    : (process.argv[refFlag + 1] ?? '').trim()
const now = Math.floor(Date.now() / 1000)

if (!/^[0-9a-f]{40}$/u.test(commit)) {
  throw new Error(`expected a full 40-character commit sha, got ${JSON.stringify(commit)}`)
}

const index = {
  format: 1,
  title: { zh: 'wuqiwen 的 DSH 插件', en: "wuqiwen's DSH plugins" },
  description: {
    zh: '本仓库维护的 DeepSeek Harness 插件索引。',
    en: 'DeepSeek Harness plugins maintained in this repository.',
  },
  metadata: {
    categories: { appearance: { title: { zh: '外观', en: 'Appearance' } } },
    labels: { 'open-source': { title: { zh: '开源', en: 'Open source' } } },
    sortKeys: { updated: { title: { zh: '更新时间', en: 'Updated' }, order: 'desc' } },
  },
  plugins: [
    {
      name: manifest.name,
      title: { zh: '自定义背景', en: 'Custom Wallpaper' },
      description: {
        zh: '左下角浮窗上传并切换壁纸，可调遮罩与模糊，内置三张壁纸。',
        en: 'Upload and switch wallpapers from a bottom-left floating panel, with scrim and blur sliders and three bundled wallpapers.',
      },
      icon: `data:image/svg+xml;base64,${icon.toString('base64')}`,
      author: 'wuqiwen',
      homepage: 'https://github.com/wuqiwenpk/dsh-custom-bg#readme',
      repository: { url: 'https://github.com/wuqiwenpk/dsh-custom-bg' },
      metadata: {
        category: 'appearance',
        labels: ['open-source'],
        keywords: ['wallpaper', 'background', 'theme', 'ui', '自定义背景', '壁纸'],
        sortKeys: { updated: now },
      },
      versions: [
        {
          version: manifest.version,
          publishTimestamp: now,
          source: { type: 'git', url: 'https://github.com/wuqiwenpk/dsh-custom-bg', commit },
        },
      ],
    },
  ],
}

mkdirSync(join(root, 'market'), { recursive: true })
writeFileSync(join(root, 'market/index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(`market/index.json: ${manifest.name}@${manifest.version} -> ${commit}`)
