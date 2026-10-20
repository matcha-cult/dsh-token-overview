[English](README.en.md)

# dsh-token-overview

一个 DeepSeek Harness Web 插件，不用离开会话就能回答一个问题：
**这次智能体运行总共消耗了多少 token？**

原生会话头部只显示当前挂载（Lead）会话的 usage 药丸。本插件在头部操作区新增
**`token总览`** 入口：点击后，文字下方弹出浮窗，按代理列出当前会话树的 token 总量——
Lead 以及它委派的所有 teammate / subagent——并给出合计。

## 功能

- **头部入口，不新增页面。** 一次点击、一个浮窗，不需要跳转。
- **整场运行一个数。** 递归累加 Lead 与所有被委派的子会话。
- **逐代理明细。** 名称、角色（Lead / Teammate / Subagent）、token 总量与占比。
- **与宿主同一口径。** 读取宿主算好的 `tokenUsage` 投影，四个桶与自带 usage 药丸完全一致：
  `未命中输入 + 缓存读 + 缓存写 + 输出`。
- **团队感知的名称。** 优先用持久的 `agentTeam` roster 取 teammate 名称，普通子代理回退到
  `subagentCatalog` 标签。
- **实时刷新。** 代理还在运行时数字也会更新，因为浮窗订阅的是与 UI 其他部分相同的
  Client 会话 store。
- **主题原生。** 只用 `--dsw-alias-*` 主题 token 着色，明暗主题均可。

## 安装

本仓库是一个 DSH bundle：Host 半边是空操作，Web Client 模块注册头部入口。

1. 把仓库克隆到固定位置。
2. 在 DeepSeek Harness 中用 Plugin Manager 从该目录安装 bundle（安装 bundle → 本地目录），
   或在需要启用它的 profile 里选中该 bundle。包名是 `dsh-token-overview`，无需构建。
3. 刷新 Web 页面。`token总览` 入口会出现在会话头部。

插件依赖标准 Web 会话 UI（`conversation.session.header.actions`）与 sessions Client 服务。
它不贡献任何 Host 工具、提示词或模型可见内容。

## 使用

1. 打开一个运行过团队或委派过子代理的会话。
2. 点击头部的 **`token总览`**。
3. 看浮窗：每个代理一行，按会话树顺序排列并带占比；底部是本场总计与缓存命中率。

点击外部或按 `Esc` 关闭。

### 计数口径

- **总量** = `uncachedInputTokens + cacheReadTokens + cacheWriteTokens + outputTokens`。
  这是处理量——也就是 Web UI usage 药丸显示的值——不是账单金额。缓存读通常便宜一个数量级；
  需要成本时按各桶单价加权。
- **会话树** = 当前会话，以及通过 `parentId` + `origin: "subagent"` 可达、并与
  `subagentCatalog` 条目合并的后代。
- **名称** 优先取 lead 会话的 `agentTeam` roster；没有时回退到子会话的持久 subagent 标签 /
  会话标题。
- 直接以 teammate/subagent 身份打开会话时，浮窗仍然从本次运行的顶层会话开始汇总。

## 限制

- **Fork 继承前缀。** DSH 的 Client `tokenUsage` 投影会包含带种子（fork）子会话继承的
  前缀。浏览器看不到继承切分，因此用过 `subagent_fork` 的运行可能把父前缀多算一次。
  需要精确的“自身后缀”口径时，请使用配套 CLI `dsh-token-report`（读取同一份磁盘日志并跳过
  继承前缀）。
- **外部后端。** ACP / Codex / Claude Code 子会话没有 DSH 会话投影，其 token 不计入本合计。
- **一次只汇总一棵会话树。** 跨会话或按天的合计不在范围内；请用 CLI 做全库报表。
- 数字依赖子会话的投影已下发。冷子会话若还没读过投影缓存，浮窗会请求
  `refreshProjections()`，到达后补上该行。

## 开发

纯 JavaScript；无构建、无依赖。布局是四个文件加资源：

| 文件 | 作用 |
| --- | --- |
| `package.json` | bundle 清单、`dsh.bundle.patch`、`dsh.client` 声明 |
| `cordis.patch.yml` | 插入 `token-overview` 行 |
| `index.js` | Host 半边（空操作） |
| `client.js` | Client 模块：状态模型、浮窗、样式、locale 字典 |
| `locale/en.json`、`locale/zh.json` | Plugin Manager 展示元数据 |
| `icon.svg` | 插件图标 |

Client 模块是通过 `window.__ModuleLoader__` 加载的惰性工厂；它在
`conversation.session.header.actions` 注册一个槽位条目，并绑定自己的 locale 命名空间
`dsh-token-overview`。

## 测试

```bash
node test/smoke.mjs
```

冒烟测试用一个小型 React hooks 替身渲染注册的头部入口，打开浮窗并断言聚合后的行、占比与
总计（不需要浏览器或 DOM）。

## 许可

MIT
