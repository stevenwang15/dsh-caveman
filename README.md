# dsh-caveman

**让 DSH 里的 agent 少说废话、多留事实。** 这是 [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) 的 DeepSeek Harness 非官方移植：14 个原生 DSH 技能，输入 `/caveman` 就能用。

上游那句话是 **"why many token when few do trick"**：同一句修复，普通 agent 写 63 token，caveman 写 20 token，代码、命令、路径、报错字符一个不改。

> ⚠️ **许可证更正：caveman 不是 MIT。** 3.0.0 起整个仓库是 **Apache-2.0**；根目录 `LICENSE-MIT` 只是保留 3.0.0 之前 MIT 部分的历史贡献声明。Apache-2.0 允许改造与分发，但要求随包带 `LICENSE`、保留 `NOTICE`、声明修改——本包逐条做到了，见 [NOTICE](NOTICE) 与下文「Apache-2.0 要求与逐条落实」。另外 "Caveman" 是 Julius Brussee 的商标：本包是**非官方移植**，用名称只做指称（nominative use），不暗示官方背书。

---

## 装了什么（14 个技能，三组）

### 1. 语气组（output，8 个）

| 技能 | 触发 | 做什么 |
| --- | --- | --- |
| `caveman` | `/caveman` | 主语气：先给答案，去掉客套与总结，技术事实全留 |
| `ultracave` | `/ultracave` · `/caveman ultra` | 极限压缩：片段化、能一个词就一个词（仅用户可调用） |
| `megacave` | `/megacave` · `/caveman wenyan` | 文言文语气，字数更少，术语原样（仅用户可调用） |
| `caveman-commit` | `/caveman-commit` | Conventional Commits：祈使句、≤50 字符、不写 AI 署名 |
| `caveman-review` | `/caveman-review` | 一行一条评审：`L42: bug: user 可能为 null。加 guard。` |
| `caveman-help` | `/caveman-help` | 命令速查卡 |
| `caveman-stats` | `/caveman-stats` | 诚实报用量：指向宿主用量视图，明说省了多少没测过 |
| `caveman-compress` | `/caveman-compress <路径>` | 把 AGENTS.md / CLAUDE.md / todo 压成 caveman 体，省输入 token |

### 2. 压缩组的安全设计（`caveman-compress` 是改造过的）

上游用 Python CLI 把文件**发给外部模型端点**。DSH 里有模型在跑，所以本移植去掉了外发：

- **不外发**：当前会话的模型就地压缩，不调 `claude` CLI、不调 API、不读 key；
- **备份在源目录之外**：`.caveman/backups/<相对路径>.original.md`——`AGENTS.md.original.md` 放在旁边会被 agent 当成活指令再读一遍；
- **覆盖前过闸**：`skills/caveman-compress/scripts/verify-compress.mjs` 校验代码块/行内代码逐字未变、标题未丢、URL/环境变量/否定词未丢、文件确实变小，任一条不过就还原；
- **先拒绝**：`.env`、`credentials*`、`*.key`、`*.pem`、`id_rsa*` 等敏感文件名**读都不读**直接拒绝；只压 `.md/.txt/.typ/.typst/.tex` 和数字后缀文本，不碰代码文件；
- **只报字节，不报节省**：字节不是 token，宿主没有对照测量。

### 3. native 工作流纪律组（6 个，仅提示词）

| 技能 | 用在什么时候 |
| --- | --- |
| `investigate-first` | 原因不明的故障：先证据后结论，没找到机制不改代码 |
| `lean-build` | 容易过度设计的新功能：先复用、守住范围、写明停止条件 |
| `migration` | schema/数据/API/协议/配置/依赖迁移：先映射读写方与兼容窗口，证明可回滚 |
| `safe-refactor` | 重构但要行为不变：用验证夹住结构改动 |
| `surgical-patch` | 小 bug 修在最窄的负责层，带回归证明 |
| `verify-and-stop` | 只验证不扩范围：跑门禁、给证据、停 |

这 6 个共享上游 `native-core.md`（构建最简完整系统的那段默认），插件在加载时把它追加到每个技能正文后面。

## 和上游的差异（诚实降级，不假装）

| 上游有 | DSH 没有 | 本插件的处理 |
| --- | --- | --- |
| hook 写标志文件实现跨轮模式持久 | 无 hooks | 模式只在会话内保持；模型不读写任何 mode 文件 |
| statusline / `Caveman mode:` 注入 | 无 statusline | status 回答带 `(not tracked by this host)` |
| 任务分类器决定 native 技能何时生效 | 无分类器 | 注册为模型可调用技能，按 description 匹配，偏离时说明 |
| transcript 计数算节省 | 无该数据 | 明说 savings unknown，不编数字 |
| CLI/proxy/engine/MCP（省输入 token） | 未移植 | 见下 |

**没移植**（依赖上游 Go 运行时或 subagent preset）：`cavecrew`（要 cavecrew-* 三个 preset）、`caveman-discover/explore/learn/manage/optimize/setup/evidence-review`（要 Caveman CLI 与本地实验数据）、以及 CLI/proxy/engine/MCP/shrink。

## 安装

```bash
cd dsh-caveman
npm pack                                   # 生成 dsh-caveman-0.2.1.tgz
./scripts/install-local.sh desktop         # 备份 profile → pnpm add → 加进 dsh.profile.bundles
```

装完**不用重启**：DSH 的 HMR 会在 profile 配置变化时重排组合并重新加载 bundle。实测发现**只改 package.json 的 bundle 列表不会重载模块**（宿主仍持有旧实例），改 `cordis.patch.yml` 才会——`scripts/dev-reload.sh` 就是干这个的，它会清理并刷新一行标记注释。卸载：

```bash
./scripts/uninstall-local.sh desktop
```

## 验证（已完成，可复跑）

```bash
npm test        # 三组一起跑
```

| 测试 | 断言什么 | 结果 |
| --- | --- | --- |
| `test/smoke.mjs` | 14 个技能注册、描述 ≤500 字符、resourceBase 真实目录、归因在正文、native-core 只进 native 组、compress 闸门与备份路径、不承诺宿主没有的能力 | **155/155** |
| `test/dsh-contract.mjs` | 从**已安装 App 的 app.asar** 里取出 `dsh-skill` 的真实 `validateRuntimeSkill`/`validateDefinition` 源码并执行，验证每个定义能过当前版本的加载期校验 | **30/30** |
| `test/compress-gate.mjs` | 安全压缩放行；改代码块/丢标题/丢 URL/丢否定词/丢环境变量/没变小，全部拒绝 | **9/9** |

**真机验证**：装进 desktop profile 后，当前会话的技能目录直接多出 `caveman`/`caveman-commit`/`caveman-help`/`caveman-review`/`caveman-stats` 等（`ultracave`/`megacave` 按 `modelInvocable:false` 对模型隐藏，只在用户输入时出现），`skill("caveman")` 返回的正文与 resourceBase 指向安装目录——说明注册、注入、资源基地址三条链路都通。

## Apache-2.0 要求与逐条落实

Apache-2.0 比 MIT 多的义务，逐条对应到本包：

| 条款 | 要求 | 本包做法 |
| --- | --- | --- |
| §4(a) | 随分发给接收方一份 License | `LICENSE` = Apache-2.0 全文 |
| §4(b) | 修改过的文件要显著声明改动 | `NOTICE` 的 "State changes" 逐条列出；`caveman-compress/SKILL.md` 头部注释标明 ADAPTED；`index.js` 头部说明是新增文件与追加说明 |
| §4(c) | 保留源作品的版权/专利/商标/归属声明 | 每个技能的正文末尾带 `Ported from JuliusBrussee/caveman (Apache-2.0)`，`NOTICE` 含上游版权行 |
| §4(d) | 源作品有 NOTICE 时，须附上与被衍生作品相关的归属声明 | 上游 NOTICE **逐字**收录在 `NOTICE` 的 "Upstream NOTICE" 段，本包的声明追加在其后 |
| §6 | 不授予商标权 | `NOTICE` 与 README 明确写商标归属与非官方关系，名称仅作指称 |
| §3/§5 | 专利授权与贡献条款自动生效 | 无需额外动作 |
| 无二进制 | 上游 Go 运行时的第三方许可文本义务 | 本包只分发技能文本，不分发任何 Go 二进制，故不适用；`NOTICE` 中已说明 |

**一句话**：可以用、可以改、可以发，但**不能不带 LICENSE/NOTICE**、**不能把改动说成上游原样**、**不能暗示官方**。本包这三点都守住了。

## 目录

```
dsh-caveman/
├── index.js                     # 注册 14 个技能 + 按组追加 DSH runtime 说明（新增文件）
├── cordis.patch.yml             # bundle layer
├── skills/
│   ├── <name>/SKILL.md          # 上游正文逐字复制（Apache-2.0）
│   ├── caveman-compress/SKILL.md          # 唯一改造文件（头部已标明 ADAPTED）
│   ├── caveman-compress/scripts/verify-compress.mjs  # 压缩闸门
│   └── native-core.md           # 上游 native 组共享默认（逐字）
├── scripts/install-local.sh / uninstall-local.sh
├── test/smoke.mjs · dsh-contract.mjs · compress-gate.mjs
├── LICENSE  # Apache-2.0 全文
├── NOTICE   # 上游 NOTICE 逐字 + 本移植的修改与商标声明
└── package.json  # 固定上游 version/commit，便于重新同步
```

**同步上游**：把 `skills/<name>/SKILL.md` 与 `skills/native-core.md` 用上游同路径文件覆盖；`caveman-compress` 例外（改造过，需人工合并）。`index.js` 不用改，DSH 说明自动追加。上游 commit 记在 `package.json` 的 `caveman.upstreamCommit`。
