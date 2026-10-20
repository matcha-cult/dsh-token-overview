/**
 * Smoke test for the Client half without a browser.
 *
 * It loads `client.js` through a fake `window.__ModuleLoader__`, applies the
 * plugin to a fake context, renders the registered header action with a small
 * React-hooks stand-in, opens the popover and asserts the aggregated rows.
 *
 * The hook stand-in keeps the same call order as the component; if the
 * component's hook order changes, update `refSeeds` below.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const clientPath = fileURLToPath(new URL('../client.js', import.meta.url));

let factory;
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  __ModuleLoader__: { load(spec) { factory = spec.factory; } },
};
globalThis.document = {
  body: {},
  head: { appendChild() {} },
  createElement() { return { dataset: {}, appendChild() {}, remove() {}, textContent: '' }; },
  addEventListener() {},
  removeEventListener() {},
};

new Function('window', 'document', fs.readFileSync(clientPath, 'utf8'))(globalThis.window, globalThis.document);

const hooks = { cursor: 0, values: [] };
const refSeeds = {
  2: { current: { contains: () => false } },                                    // rootRef
  3: { current: { getBoundingClientRect: () => ({ right: 1200, bottom: 90 }) } }, // triggerRef
  4: { current: { focus() {}, contains: () => false } },                         // panelRef
  5: { current: new Set() },                                                     // requestedRef
};
const React = {
  createElement(type, props, ...children) {
    return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } };
  },
  useState(init) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof init === 'function' ? init() : init;
    return [hooks.values[index], (next) => { hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next; }];
  },
  useRef(init) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = refSeeds[index] ?? { current: init };
    return hooks.values[index];
  },
  useMemo(fn) { hooks.cursor++; return fn(); },
  useEffect() { hooks.cursor++; },
  useLayoutEffect() { hooks.cursor++; },
  useCallback(fn) { hooks.cursor++; return fn; },
};

const usage = (uncached, output, cacheRead, cacheWrite) => ({ uncachedInputTokens: uncached, outputTokens: output, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite });
const byId = {
  lead: { id: 'lead', displayTitle: 'Team run', running: true, projectionValues: { tokenUsage: usage(1000, 500, 2000000, 0) } },
  a: { id: 'a', parentId: 'lead', origin: 'subagent', displayTitle: 'a', projectionValues: { tokenUsage: usage(200, 100, 500000, 0), subagent: { mode: 'continuable', label: 'alpha' } } },
  b: { id: 'b', parentId: 'lead', origin: 'subagent', displayTitle: 'b', projectionValues: { tokenUsage: usage(300, 150, 800000, 0), subagent: { mode: 'continuable', label: 'beta' } } },
  c: { id: 'c', parentId: 'a', origin: 'subagent', displayTitle: 'c', projectionValues: { tokenUsage: usage(50, 25, 100000, 0), subagent: { mode: 'continuable', label: 'gamma' } } },
};
const team = {
  members: [
    { id: 'lead', name: 'lead', role: 'lead' },
    { id: 'a', name: 'alpha', role: 'teammate' },
    { id: 'b', name: 'beta', role: 'teammate' },
  ],
  tasks: [],
};
const projectionsBySession = {
  lead: { values: { agentTeam: team } },
  a: { values: { subagentCatalog: [{ id: 'c', label: 'gamma', mode: 'continuable' }] } },
};
const t = (key, params) => {
  if (key === 'tokensK') return `${params.value}K`;
  if (key === 'tokensM') return `${params.value}M`;
  if (key === 'cacheHit') return `${params.percent}%`;
  if (key === 'agents') return `${params.count} agents`;
  return key;
};
let registered;
const ctx = {
  locale: { bind: () => t, register: () => () => {} },
  effect: (fn) => { fn(); },
  get: () => ({ refreshProjections: () => Promise.resolve() }),
  slots: {
    inject: (name, cb) => { cb(); return () => {}; },
    register: (opts, component) => { registered = { opts, component }; return () => {}; },
  },
};
factory((name) => {
  if (name === 'react') return React;
  if (name === 'react-dom') return { createPortal: (children) => children };
  throw new Error(`unexpected require ${name}`);
}).apply(ctx);

const Comp = registered.component;
assert.equal(registered.opts.name, 'conversation.session.header.actions');
assert.equal(registered.opts.id, 'token-overview');

function renderTree(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(renderTree);
  if (typeof node.type === 'function') return renderTree(node.type(node.props));
  if (node.props !== undefined) return { ...node, props: { ...node.props, children: renderTree(node.props.children) } };
  return node;
}
function findAll(node, predicate, out = []) {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) { for (const child of node) findAll(child, predicate, out); return out; }
  const children = node.props?.children;
  if (Array.isArray(children)) for (const child of children) findAll(child, predicate, out);
  else if (children !== undefined) findAll(children, predicate, out);
  if (predicate(node)) out.push(node);
  return out;
}

function openPanel(sessionId) {
  hooks.cursor = 0;
  hooks.values = [];
  const props = {
    sessionId,
    useSessions: (selector) => selector({ byId, projectionsBySession }),
    useProjection: (key) => {
      if (key === 'tokenUsage') return byId[sessionId]?.projectionValues?.tokenUsage;
      if (key === 'agentTeam') return sessionId === 'lead' ? team : undefined;
      return undefined;
    },
    sessions: { refreshProjections: () => Promise.resolve() },
    t,
  };
  let tree = renderTree(Comp(props));
  const button = findAll(tree, (node) => node.type === 'button')[0];
  button.props.onClick();
  hooks.cursor = 0;
  tree = renderTree(Comp(props));
  const panel = findAll(tree, (node) => node.props?.className === 'dto-panel')[0];
  assert.ok(panel, 'the popover opens after a click');
  return panel;
}

const rowsOf = (panel) => findAll(panel, (node) => node.props?.className === 'dto-row').map((row) => {
  const [, name, role, tokens, share] = row.props.children;
  return { name: name.props.children, role: role.props.children, tokens: tokens.props.children, share: share.props.children };
});

const leadPanel = openPanel('lead');
assert.deepEqual(rowsOf(leadPanel).map((row) => row.name), ['lead', 'alpha', 'gamma', 'beta']);
assert.deepEqual(rowsOf(leadPanel).map((row) => row.tokens), ['2M', '500.3K', '100.1K', '800.5K']);
assert.deepEqual(rowsOf(leadPanel).map((row) => row.share), ['58.8%', '14.7%', '2.9%', '23.5%']);
assert.equal(findAll(leadPanel, (node) => node.props?.className === 'dto-total')[0].props.children, '3.4M');

// Viewing the run from a teammate's header still aggregates the same run.
const childPanel = openPanel('a');
assert.equal(findAll(childPanel, (node) => node.props?.className === 'dto-total')[0].props.children, '3.4M');
assert.deepEqual(rowsOf(childPanel).map((row) => row.name), ['lead', 'alpha', 'gamma', 'beta']);

console.log('ok: token-overview client smoke test');
