# 上架到插件市场 —— 还差的步骤

结论先说：**不需要 npm，也不需要任何「发布」命令**。桌面上的「插件市场」
（dshmarket）搜的是 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
的精选目录，能被搜到的唯一条件是那份目录里有你的条目，也就是一次 PR。

---

## 0. 先修一个会挡路的全局配置（重要）

这台机器的 `~/.gitconfig` 有一条：

```
url.https://gitclone.com.insteadof=https://
```

它把每个 `https://…` 的 git 地址改写成 `https://gitclone.com…`（镜像早已失效），
所以 `git push`、`git clone`、以及市场里从 GitHub 安装插件（`git+https://…`）
全都会失败——这也解释了为什么上次是网页传的代码。

```powershell
git config --global --unset url.https://gitclone.com.insteadof
```

## 1. 把这条修正接到远端（可选，但建议）

你上次推的是一个压缩后的 `core init`（6b7234b），本地原本那 5 个提交不在远端，
所以 `market/index.json` 里钉的 commit `aecfc9f` 在 GitHub 上不存在 —— 谁用这份
索引安装都会失败。已经改成远端真实存在的 `6b7234b…`，并把 raw URL 的 `main`
改成真实默认分支 `master`。把 patch 接上去：

```powershell
cd D:\test\ai\dsh-custom-bg
git remote set-url origin https://github.com/wuqiwenpk/dsh-custom-bg.git
git fetch origin master
git reset --hard origin/master          # 丢弃本地那 5 个已废弃提交（内容已在 core init 里）
git apply D:\test\ai\custom-bg-index-fix.patch
git add -A
git commit -m "fix: pin the index to a commit that exists on GitHub"
git push origin master
```

不想用命令也行：网页上改两个字段就够 —— `market/index.json` 里
`plugins[0].versions[0].source.commit` 改成 `6b7234ba87e7b2327af4a5c83c6f1395511d7b9b`；
`market/awesome-dsh-plugin.yml` 里 `icon` 的 `/main/` 改成 `/master/`。

## 2. 给仓库加 topic

```powershell
gh repo edit wuqiwenpk/dsh-custom-bg --add-topic dsh-plugin
```

没有 `gh` 就网页：仓库首页 → About 右侧齿轮 → Topics 填 `dsh-plugin` → Save。

## 3. 等满 1 天

仓库创建于 **2026-10-30 09:57**（+08），CI 会查「至少 1 天」，
所以 **2026-10-31 09:57 之后**再提 PR 才不会被自动判失败。

## 4. 提交收录 PR

```powershell
# 先网页 Fork：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/fork
git clone https://github.com/wuqiwenpk/awesome-dsh-plugin.git
cd awesome-dsh-plugin
New-Item -ItemType Directory -Force data\plugins | Out-Null
Copy-Item D:\test\ai\dsh-custom-bg\market\awesome-dsh-plugin.yml data\plugins\wuqiwenpk__dsh-custom-bg.yml
git checkout -b add-dsh-custom-bg
git add data/plugins/wuqiwenpk__dsh-custom-bg.yml
git commit -m "Add wuqiwenpk/dsh-custom-bg"
git push -u origin add-dsh-custom-bg
```

然后开 PR（不用 gh 也行）：

<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/compare/main...wuqiwenpk:add-dsh-custom-bg>

PR 标题：`Add wuqiwenpk/dsh-custom-bg`
PR 正文：

> Bottom-left floating panel that uploads and switches background images, with
> scrim and blur sliders and a bundled `default.jpg`. Declares `dsh.bundle`
> (`cordis.patch.yml`) and `dsh.client` (web), so it installs with
> `dsh plugin add git+https://github.com/wuqiwenpk/dsh-custom-bg.git`.

规则要求「一个 PR 只加一个文件」：`data/plugins/<owner>__<repo>.yml`，
不要手工改 README（合并后由脚本重建）。

## 5. 合并之后

目录重建后，在 设置 → 插件市场 → 刷新目录（或重启应用），
搜 `custom-bg` / `背景` / `wallpaper` 就能看到并一键安装。

---

## 更正上一轮的一句

我上一轮说的「加自建索引源」在这台机器上**用不了**：那入口属于官方的
`@deepseek-ai/dsh-plugin-market`（Discover），而你这套 Desktop 的 profile 里只有
`dshmarket`，没有那个包。索引文件我保留了（格式已用 DSH 自带校验器验证过），
但对你当前这套环境，PR 是唯一能让它出现在市场里的路径。
