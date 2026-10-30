# 上架方式 / Getting listed

插件市场（`dshmarket`）的目录由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 精选列表提供：
市场搜的是那份列表，**不是** npm 关键词。所以「能在插件市场搜索到」只依赖一条：列表里有这个仓库的条目。
本目录放着两份现成的上架物料。

## 1. 立刻可搜索：自建索引源（无需审核）

`index.json` 是插件市场格式 1 的索引，已用 DSH 自带的校验器验证通过。

1. 打开 **插件 → 发现（Discover）→ 索引源（Index sources）**
2. 添加：`https://raw.githubusercontent.com/wuqiwenpk/dsh-custom-bg/master/market/index.json`
   （仓库默认分支是 `master`，不是 `main`）
3. 在发现页搜索 `背景`、`wallpaper`、`custom-bg`，即可看到并一键安装

这条路径用自己的源，装的是本仓库当前 HEAD（`market/index.json` 里 pin 的 commit）。
改了代码后重新生成索引：

```sh
node scripts/build-index.mjs
git add market/index.json && git commit -m "chore: refresh market index"
```

## 2. 进官方目录：向 awesome-dsh-plugin 提 PR

`awesome-dsh-plugin.yml` 就是 PR 要加的那一个文件的内容。

```sh
# 1. fork + clone
git clone https://github.com/<you>/awesome-dsh-plugin.git
cd awesome-dsh-plugin

# 2. 写入条目（文件名固定为 <owner>__<repo>.yml）
mkdir -p data/plugins
cp <本仓库>/market/awesome-dsh-plugin.yml data/plugins/wuqiwenpk__dsh-custom-bg.yml

# 3. 提交 PR
git checkout -b add-dsh-custom-bg
git add data/plugins/wuqiwenpk__dsh-custom-bg.yml
git commit -m "Add wuqiwenpk/dsh-custom-bg"
git push origin add-dsh-custom-bg
```

PR 前确认三件事（他们的 CI 会查）：

- [ ] 仓库已推到 GitHub，且 `package.json` 里有 `dsh.bundle`（本仓库有）
- [ ] 仓库创建满 **1 天**
- [ ] 仓库加了 **`dsh-plugin`** topic（Settings → Topics）

合并后市场目录会重建，`插件 → 插件市场` 搜 `custom-bg`、`背景`、`wallpaper` 就能搜到，卡片图标用 `docs/icon-180.png`。

## 3. 可选：发到 npm

官方列表按仓库地址安装，npm 不是必需的。想让 `dsh plugin add dsh-plugin-custom-bg` 也能用，再发布：

```sh
npm login
npm publish     # 名字 dsh-plugin-custom-bg 在 npm 上仍然可用
```
