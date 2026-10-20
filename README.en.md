[简体中文](README.md)

# dsh-token-overview

A DeepSeek Harness Web plugin that answers one question without leaving the session:
**how many tokens did this whole agent run consume?**

The stock session header only shows the attached (Lead) session's usage pill. This plugin
adds a **`token总览`** action next to the other header actions. Click it and a floating
panel opens below the text with per-agent token totals for the current Session tree —
the Lead plus every teammate / subagent it delegated to — and the combined total.

## Features

- **Header action, not a new page.** One click, one popover; no navigation.
- **Whole run, one number.** Sums the Lead and every delegated child session recursively.
- **Per-agent breakdown.** Name, role (Lead / Teammate / Subagent), token total and share.
- **Same accounting as the host.** Reads the host-computed `tokenUsage` projection, so the
  four buckets match the built-in usage pill exactly:
  `uncached input + cache read + cache write + output`.
- **Team-aware labels.** Uses the durable `agentTeam` roster for teammate names; falls back
  to `subagentCatalog` labels for ordinary subagents.
- **Live.** Numbers refresh while agents are still running, because the panel subscribes to
  the same Client session store the rest of the UI uses.
- **Theme-native.** Styled only with `--dsw-alias-*` theme tokens; works in light and dark.

## Install

This repository is a DSH bundle: the Host half is a no-op and the Web Client module
registers the header action.

1. Clone the repository somewhere stable.
2. In DeepSeek Harness, install the bundle from that directory with the Plugin Manager
   (install bundle → local directory), or select the bundle in the profile that should
   carry it. The package is `dsh-token-overview`; no build step is required.
3. Reload the Web page. The `token总览` action appears in the conversation session header.

The plugin needs the standard Web conversation UI (`conversation.session.header.actions`)
and the sessions Client service. It contributes no Host tools, prompts, or model-visible
content.

## Usage

1. Open a session that ran a team or delegated subagents.
2. Click **`token总览`** in the header.
3. Read the panel: one row per agent, sorted in session-tree order, with shares; the footer
   shows the run total and cache hit ratio.

Click outside or press `Esc` to close.

### Counting semantics

- **Total** = `uncachedInputTokens + cacheReadTokens + cacheWriteTokens + outputTokens`.
  This is processed-token volume — what the Web UI usage pill shows — not a billing amount.
  Cached reads are usually an order of magnitude cheaper; apply prices per bucket if you
  need cost.
- **Session tree** = the current Session and descendants reached through
  `parentId` + `origin: "subagent"`, unioned with `subagentCatalog` entries.
- **Names** come from the lead session's `agentTeam` roster when present, otherwise from
  the child's durable subagent label / session title.
- When a session is opened directly as a teammate/subagent, the panel still aggregates from
  the run's top-level Session.

## Limitations

- **Fork-inherited prefixes.** DSH's Client `tokenUsage` projection includes the inherited
  prefix of a seeded (fork) child session. The browser cannot see the inherited cut, so a
  run that used `subagent_fork` may count the parent prefix once more. For exact
  own-suffix accounting, use the companion `dsh-token-report` CLI (it reads the same
  session logs on disk and skips inherited prefixes).
- **External backends.** ACP / Codex / Claude Code children have no DSH session projection,
  so their tokens are not in this total.
- **One Session tree at a time.** Cross-session or per-day totals are out of scope; use the
  CLI for store-wide reports.
- Numbers depend on projections being served for the child sessions. If a child is cold and
  its projection cache has not been read yet, the panel requests
  `refreshProjections()` and fills the row in when it arrives.

## Development

Plain JavaScript; no build, no dependencies. The layout is four files plus resources:

| File | Role |
| --- | --- |
| `package.json` | bundle manifest, `dsh.bundle.patch`, `dsh.client` declaration |
| `cordis.patch.yml` | inserts the `token-overview` row |
| `index.js` | Host half (no-op) |
| `client.js` | Client module: state model, popover, styles, locale dictionaries |
| `locale/en.json`, `locale/zh.json` | plugin-manager display metadata |
| `icon.svg` | plugin artwork |

The Client module is a lazy factory loaded through `window.__ModuleLoader__`; it registers
one slot entry in `conversation.session.header.actions` and binds its own locale namespace
`dsh-token-overview`.

## Testing

```bash
node test/smoke.mjs
```

The smoke test renders the registered header action with a small React-hooks
stand-in, opens the popover and asserts the aggregated rows, shares and total
(no browser or DOM required).

## License

MIT
