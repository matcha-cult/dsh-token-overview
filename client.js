/**
 * dsh-token-overview — Web Client half.
 *
 * Registers one action in `conversation.session.header.actions` ("token总览").
 * Clicking it opens a floating panel below the trigger with a per-agent token
 * breakdown of the current Session: the Lead plus every teammate / subagent in
 * its delegated session tree.
 *
 * Data comes exclusively from Session projections the Client already receives:
 *   - `tokenUsage` — the four durable provider-usage buckets the Web UI's own
 *     usage pill reads (uncached input + cache read + cache write + output);
 *   - `agentTeam` — durable roster names and roles for a Team root;
 *   - `subagentCatalog` — direct children and their creation labels.
 * Reading projections keeps the fold host-side; this plugin never rescans
 * session events.
 */
window.__ModuleLoader__.load({
  id: 'dsh-token-overview',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const h = React.createElement;

    const NS = 'dsh-token-overview';
    const SLOT = 'conversation.session.header.actions';
    const PANEL_WIDTH = 344;

    const CSS = [
      '.dto-root{position:relative;display:inline-flex;align-items:center}',
      '.dto-trigger{min-height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:6px;align-items:center;gap:5px;padding:3px 7px;font-size:12px;display:inline-flex;white-space:nowrap}',
      '.dto-trigger:hover,.dto-trigger:focus-visible{color:var(--dsw-alias-label-primary)}',
      '.dto-panel{position:fixed;z-index:100;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;border-radius:12px;background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.18));color:var(--dsw-alias-label-primary)}',
      '.dto-head{display:flex;align-items:baseline;gap:10px;padding:10px 14px 6px}',
      '.dto-title{flex:none;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.dto-sub{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dto-body{flex:1;min-height:0;overflow-y:auto;padding:0 8px 8px}',
      '.dto-row{display:flex;align-items:baseline;gap:7px;padding:6px 6px;border-radius:7px;font-size:12px;line-height:18px}',
      '.dto-row:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dto-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);align-self:center}',
      '.dto-dot[data-role="lead"]{background:var(--dsw-alias-brand-primary)}',
      '.dto-dot[data-role="teammate"]{background:var(--dsw-alias-state-success-primary)}',
      '.dto-dot[data-role="subagent"]{background:var(--dsw-alias-label-tertiary)}',
      '.dto-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.dto-role{flex:none;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.dto-tokens{flex:none;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}',
      '.dto-share{flex:none;width:44px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}',
      '.dto-notice{margin:0;padding:10px 6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.dto-foot{display:flex;align-items:baseline;gap:8px;padding:9px 14px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.dto-total-label{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dto-cache{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dto-total{flex:none;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}',
      '.dto-note{margin:0;padding:0 14px 10px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}'
    ].join('');

    const zh = {
      trigger: 'token总览',
      title: 'Token 总览',
      agents: '{count} 个代理',
      roleLead: 'Lead',
      roleTeammate: 'Teammate',
      roleSubagent: 'Subagent',
      total: '总计',
      cacheHit: '缓存命中 {percent}%',
      note: '口径：未命中输入 + 缓存读 + 缓存写 + 输出',
      loading: '正在读取 token 用量…',
      empty: '本会话暂无 token 用量',
      tokensK: '{value}K',
      tokensM: '{value}M'
    };
    const en = {
      trigger: 'Token overview',
      title: 'Token overview',
      agents: '{count} agents',
      roleLead: 'Lead',
      roleTeammate: 'Teammate',
      roleSubagent: 'Subagent',
      total: 'Total',
      cacheHit: 'cache hit {percent}%',
      note: 'Counted as uncached input + cache read + cache write + output',
      loading: 'Reading token usage…',
      empty: 'No token usage in this session yet',
      tokensK: '{value}K',
      tokensM: '{value}M'
    };

    /** Compact token amount, matching the conversation stats strip's shape. */
    function formatTokens(value, t) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      if (value < 1e3) return String(Math.round(value));
      if (value < 1e6) return t('tokensK', { value: Math.round(value / 100) / 10 });
      return t('tokensM', { value: Math.round(value / 1e4) / 100 });
    }
    function bucketTotal(usage) {
      if (usage === undefined || usage === null) return undefined;
      return (usage.uncachedInputTokens ?? 0) + (usage.outputTokens ?? 0)
        + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
    }
    /** Walk up from a delegated Session to the run's top Session. */
    function rootOf(sessionId, byId) {
      let current = sessionId;
      for (let hop = 0; hop < 8; hop += 1) {
        const row = byId ? byId[current] : undefined;
        if (row === undefined || row.origin !== 'subagent' || row.parentId === undefined) break;
        if (byId[row.parentId] === undefined) break;
        current = row.parentId;
      }
      return current;
    }

    /**
     * Build the aggregated row model from live Client snapshots.
     * @param sessionId - the Session whose header renders this action.
     * @param byId - Session summaries (carry projectionValues and lineage).
     * @param projectionsBySession - per-Session projection snapshots.
     * @param liveUsage - current Session's live `tokenUsage` projection.
     * @param liveTeam - current Session's live `agentTeam` projection.
     * @param t - translator for fallback names.
     * @returns the render model for the panel.
     */
    function buildModel(sessionId, byId, projectionsBySession, liveUsage, liveTeam, t) {
      const rootId = rootOf(sessionId, byId);
      const children = new Map();
      const labels = new Map();
      for (const row of Object.values(byId ?? {})) {
        if (row === null || row === undefined) continue;
        if (row.origin !== 'subagent' || row.parentId === undefined) continue;
        const list = children.get(row.parentId) ?? [];
        list.push(row.id);
        children.set(row.parentId, list);
      }
      for (const [parentId, snapshot] of Object.entries(projectionsBySession ?? {})) {
        for (const entry of snapshot?.values?.subagentCatalog ?? []) {
          if (entry === null || entry === undefined || entry.id === undefined) continue;
          if (entry.label !== undefined) labels.set(entry.id, entry.label);
          const list = children.get(parentId) ?? [];
          if (!list.includes(entry.id)) list.push(entry.id);
          children.set(parentId, list);
        }
      }
      const team = (rootId === sessionId ? liveTeam : undefined)
        ?? projectionsBySession?.[rootId]?.values?.agentTeam
        ?? byId?.[rootId]?.projectionValues?.agentTeam;
      const members = new Map();
      for (const member of team?.members ?? []) {
        if (member !== null && member !== undefined && member.id !== undefined) members.set(member.id, member);
      }
      const usageOf = (id, depth) => {
        if (depth === 0 && id === sessionId && liveUsage !== undefined) return liveUsage;
        return byId?.[id]?.projectionValues?.tokenUsage
          ?? projectionsBySession?.[id]?.values?.tokenUsage;
      };
      const nameOf = (id, depth) => {
        const member = members.get(id);
        if (member?.name !== undefined) return member.name;
        if (depth === 0) return t('roleLead');
        return labels.get(id)
          ?? byId?.[id]?.projectionValues?.subagent?.label
          ?? byId?.[id]?.displayTitle
          ?? String(id).slice(0, 8);
      };
      const roleOf = (id, depth) => {
        if (depth === 0) return 'lead';
        const role = members.get(id)?.role;
        if (role === 'teammate') return 'teammate';
        return 'subagent';
      };
      const rows = [];
      const seen = new Set();
      const visit = (id, depth) => {
        if (seen.has(id)) return;
        seen.add(id);
        const usage = usageOf(id, depth);
        rows.push({ id, depth, name: nameOf(id, depth), role: roleOf(id, depth), usage, total: bucketTotal(usage) });
        for (const child of children.get(id) ?? []) visit(child, depth + 1);
      };
      visit(rootId, 0);
      const sum = { uncached: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      let total = 0;
      let missing = 0;
      for (const row of rows) {
        if (row.usage === undefined) { missing += 1; continue; }
        sum.uncached += row.usage.uncachedInputTokens ?? 0;
        sum.output += row.usage.outputTokens ?? 0;
        sum.cacheRead += row.usage.cacheReadTokens ?? 0;
        sum.cacheWrite += row.usage.cacheWriteTokens ?? 0;
        total += row.total;
      }
      const inputSide = sum.uncached + sum.cacheRead + sum.cacheWrite;
      return {
        rootId,
        rootTitle: byId?.[rootId]?.displayTitle ?? '',
        rows,
        total,
        known: rows.length - missing,
        missing,
        cacheHit: inputSide > 0 ? (100 * sum.cacheRead) / inputSide : null
      };
    }

    function Row({ row, total, t }) {
      const roleKey = row.role === 'lead' ? 'roleLead' : row.role === 'teammate' ? 'roleTeammate' : 'roleSubagent';
      const share = total > 0 && row.total !== undefined ? (100 * row.total) / total : null;
      const indent = row.depth > 1 ? { paddingLeft: `${6 + (row.depth - 1) * 14}px` } : undefined;
      return h('div', { className: 'dto-row', style: indent },
        h('span', { className: 'dto-dot', 'data-role': row.role }),
        h('span', { className: 'dto-name', title: row.name }, row.name),
        h('span', { className: 'dto-role' }, t(roleKey)),
        h('span', { className: 'dto-tokens' }, row.usage === undefined ? '…' : formatTokens(row.total, t)),
        h('span', { className: 'dto-share' }, share === null ? '—' : `${Math.round(share * 10) / 10}%`)
      );
    }

    function TokenOverview({ sessionId, useSessions, useProjection, sessions, t }) {
      const byId = useSessions((state) => state.byId);
      const projectionsBySession = useSessions((state) => state.projectionsBySession);
      const liveUsage = useProjection('tokenUsage');
      const liveTeam = useProjection('agentTeam');
      const [open, setOpen] = React.useState(false);
      const [position, setPosition] = React.useState(null);
      const rootRef = React.useRef(null);
      const triggerRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const requested = React.useRef(new Set());

      const model = React.useMemo(
        () => buildModel(sessionId, byId, projectionsBySession, liveUsage, liveTeam, t),
        [sessionId, byId, projectionsBySession, liveUsage, liveTeam, t]
      );

      const place = React.useCallback(() => {
        const trigger = triggerRef.current;
        if (trigger === null) return;
        const rect = trigger.getBoundingClientRect();
        const width = Math.min(PANEL_WIDTH, Math.max(240, window.innerWidth - 32));
        const left = Math.min(Math.max(16, rect.right - width), Math.max(16, window.innerWidth - width - 16));
        const top = rect.bottom + 6;
        const maxHeight = Math.max(200, Math.min(460, window.innerHeight - top - 16));
        setPosition({ left, top, width, maxHeight });
      }, []);

      const changeOpen = React.useCallback((next) => {
        if (next) place();
        setOpen(next);
      }, [place]);

      React.useEffect(() => {
        setOpen(false);
        requested.current.clear();
      }, [sessionId]);

      React.useLayoutEffect(() => {
        if (!open || position === null) return;
        panelRef.current?.focus();
      }, [open, position]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onPointer = (event) => {
          const target = event.target;
          if (!(target instanceof Node)) return;
          if (rootRef.current?.contains(target) === true) return;
          if (panelRef.current?.contains(target) === true) return;
          setOpen(false);
        };
        const onKey = (event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        };
        const reposition = () => place();
        document.addEventListener('pointerdown', onPointer, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', reposition);
        document.addEventListener('scroll', reposition, true);
        return () => {
          document.removeEventListener('pointerdown', onPointer, true);
          document.removeEventListener('keydown', onKey, true);
          window.removeEventListener('resize', reposition);
          document.removeEventListener('scroll', reposition, true);
        };
      }, [open, place]);

      const missingKey = model.rows.filter((row) => row.usage === undefined).map((row) => row.id).join(',');
      React.useEffect(() => {
        if (!open || missingKey === '' || sessions === undefined) return;
        for (const id of missingKey.split(',')) {
          if (requested.current.has(id)) continue;
          requested.current.add(id);
          try {
            const pending = sessions.refreshProjections(id);
            if (pending !== undefined && pending !== null && typeof pending.catch === 'function') pending.catch(() => {});
          } catch { /* optional projection refresh: keep the partial view */ }
        }
      }, [open, missingKey, sessions]);

      const panel = open && position !== null
        ? ReactDOM.createPortal(
          h('div', {
            ref: panelRef,
            className: 'dto-panel',
            role: 'dialog',
            tabIndex: -1,
            'aria-label': t('title'),
            style: position
          },
          h('div', { className: 'dto-head' },
            h('span', { className: 'dto-title' }, t('title')),
            h('span', { className: 'dto-sub', title: model.rootTitle }, model.rootTitle !== '' ? model.rootTitle : t('agents', { count: model.rows.length }))
          ),
          h('div', { className: 'dto-body' },
            model.rows.length === 0
              ? h('p', { className: 'dto-notice' }, t('empty'))
              : model.rows.map((row) => h(Row, { key: row.id, row, total: model.total, t }))
          ),
          h('div', { className: 'dto-foot' },
            h('span', { className: 'dto-total-label' }, t('total')),
            h('span', { className: 'dto-cache' }, model.cacheHit === null ? '' : t('cacheHit', { percent: Math.round(model.cacheHit * 10) / 10 })),
            h('strong', { className: 'dto-total' }, model.known > 0 ? formatTokens(model.total, t) : '—')
          ),
          h('p', { className: 'dto-note' }, t('note'))
          ),
          document.body
        )
        : null;

      return h('div', { className: 'dto-root', ref: rootRef },
        h('button', {
          type: 'button',
          ref: triggerRef,
          className: 'dto-trigger',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-label': t('trigger'),
          onClick: () => changeOpen(!open)
        }, t('trigger')),
        panel
      );
    }

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        const sessions = ctx.get('sessions');
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-overview: dictionaries');
        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-token-overview';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove(); };
        }, 'token-overview: styles');
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: 'token-overview',
          order: 0
        }, (props) => h(TokenOverview, { ...props, sessions, t })));
      }
    };
  }
});
