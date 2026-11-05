# dsh-caveman

**让 DSH 里的 agent 少说废话、多留事实。** 这是 [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) 的 DeepSeek Harness 非官方移植：把它的语气技能注册成 7 个原生 DSH 技能，输入 `/caveman` 就能用。

上游那句话是 **"why many token when few do trick"**：同一句修复，普通 agent 写 63 token，caveman 写 20 token，代码、命令、路径、报错字符一个不改。

> ⚠️ 许可证更正：caveman **不是 MIT**。3.0.0 起整个仓库是 **Apache-2.0**（`LICENSE-MIT` 只是保留 3.0.0 之前 MIT 部分的历史贡献声明）。Apache-2.0 仍然可以改造和分发，但必须随包带 `LICENSE` + `NOTICE` 并声明修改——这正是本包做的事（见 [NOTICE](NOTICE)）。另外 "Caveman" 是 Julius Brussee 的商标，本包是**非官方移植**、不暗示官方背书。

---

## 装了什么

| 技能 | 触发 | 做什么 |
| --- | --- | --- |
| `caveman` | `/caveman` | 主语气：先给答案，去掉客套与总结，技术事实全留 |
| `ultracave` | `/ultracave` 或 `/caveman ultra` | 极限压缩：片段化、能一个词就一个词 |
| `megacave` | `/megacave` 或 `/caveman wenyan` | 文言文语气，字数更少，术语原样 |
| `caveman-commit` | `/caveman-commit` | Conventional Commits 提交信息：祈使句、≤50 字符、不写 AI 署名 |
| `caveman-review` | `/caveman-review` | 一行一条的代码评审：`L42: bug: user 可能为 null。加 guard。` |
| `caveman-help` | `/caveman-help` | 命令速查卡 |
| `caveman-stats` | `/caveman-stats` | 诚实报用量：指向宿主自己的用量视图，明确说「省了多少没测过」 |

退出：说 **"stop caveman"** 或 **"normal mode"**，或换会话。

## 和上游的差异（重要）

DSH 没有 caveman 依赖的 hook 体系，所以做了三处诚实降级，而不是假装有：

1. **模式是会话内的，不落盘。** 上游靠 hook 写标志文件实现跨轮持久；DSH 里加载后由模型自己保持，直到你说停。插件不会读写任何 mode 文件（根本没有）。
2. **status 必须标 `(not tracked by this host)`。** `/caveman status` 只能回答「对话里最后一次生效的模式」，不能假装读到存储状态。
3. **节省量不编。** 上游的 stats 在 Claude Code 里读 transcript 计数；DSH 侧没有对应数据，所以 `caveman-stats` 只指路 + 明说 savings unknown，不算 token、不换算成钱。

**没移植**（依赖上游 Go 运行时/CLI，和「省输出 token」这条主线无关）：`proxy` / `engine` / `MCP` / `shrink`（省的是**输入** token）、`caveman-compress`（依赖 Python + 外部模型端点）、`caveman-discover` / `explore` / `learn` / `manage` / `optimize` / `setup` / `evidence-review`。

## 安装

```bash
cd dsh-caveman
npm pack                                  # 生成 dsh-caveman-0.1.0.tgz
./scripts/install-local.sh desktop        # 默认 profile 是 desktop
```

脚本会先备份 profile 的 `package.json` / `cordis.patch.yml` / `pnpm-lock.yaml`，再 `pnpm add file:<tgz>`，最后把 `dsh-caveman` 加进 `dsh.profile.bundles`。装完重启 DeepSeek Harness，在 Settings → Plugins 里能看到 **dsh-caveman**。

卸载：

```bash
./scripts/uninstall-local.sh desktop
```

## 自测

```bash
node test/smoke.mjs
# 或者用 DSH 自带 Node：
~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node test/smoke.mjs
```

smoke test 校验：7 个技能都注册、描述 ≤500 字符（目录上限）、`source`/`provider`/`content` 满足 dsh-skill 的**加载期**校验、resourceBase 指向真实目录、Apache-2.0 归因在正文里、以及**没有任何技能承诺 DSH 没有的 hook / 存储模式 / 已测节省**。

## 目录

```
dsh-caveman/
├── index.js                 # 注册 7 个技能 + 追加 DSH runtime 说明（新代码，Apache-2.0 §4(b) 声明见 NOTICE）
├── cordis.patch.yml         # bundle layer：把插件插进 profile 组合
├── skills/<name>/SKILL.md   # 上游正文逐字复制（Apache-2.0）
├── test/smoke.mjs           # 契约测试
├── scripts/install-local.sh / uninstall-local.sh
├── LICENSE                  # Apache-2.0 全文
├── NOTICE                   # 上游版权 + 本移植的修改声明 + 商标声明
└── package.json             # 含上游版本/commit 固定，便于重新同步
```

**同步上游**：把 `skills/*/SKILL.md` 用上游同路径文件覆盖即可，`index.js` 里的 DSH 说明会自动追加，不用改代码。上游 commit 记在 `package.json` 的 `caveman.upstreamCommit`。
