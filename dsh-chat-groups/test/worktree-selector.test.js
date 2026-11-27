import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const slot = 'conversation.hero.options'
const sessionId = 'blank-with-draft'
const tick = () => new Promise(resolve => setImmediate(resolve))
const source = getSnapshot => ({ getSnapshot, subscribe: () => () => {} })
const initial = {
  defaultPath: '/repo', currentPath: '/repo', editable: true,
  worktrees: [
    { path: '/repo', branch: 'main', commit: '123456789', selectable: true },
    { path: '/topic', branch: null, commit: 'abcdef0123456789', selectable: true },
    { path: '/other', branch: 'test', commit: '123456789', selectable: false, blockedReason: 'read-only' },
  ],
}

// Drive the registered hero component through its hook lifetimes without a browser runtime.
function fixture({ snapshot = initial, apply, list, dock = false, lifecycle = { openState: 'open', blank: false, running: false } } = {}) {
  const slots = new Map(), copies = new Map(), calls = [], notices = []
  const hooks = [], effects = []
  let cursor = 0, forgeRequest = null, enable
  function memo(value, deps) {
    const i = cursor++, previous = hooks[i]
    if (!previous || deps.some((item, k) => !Object.is(item, previous.deps[k]))) {
      hooks[i] = { deps, value: value(previous?.value) }
    }
    return hooks[i].value
  }
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    Fragment: Symbol('fragment'), useCallback: (fn, deps) => memo(() => fn, deps), useMemo: memo,
    useState(value) { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], v => { hooks[i] = v }] },
    useRef: initialValue => memo(() => ({ current: initialValue }), []),
    useSyncExternalStore: (_subscribe, get) => get(),
    useEffect(effect, deps) {
      memo(previous => {
        const job = {}
        effects.push(() => { previous?.cleanup?.(); job.cleanup = effect() })
        return job
      }, deps)
    },
  }
  react.useLayoutEffect = react.useEffect
  const window = new EventTarget()
  const panel = source(() => ({ state: { worktree: { request: forgeRequest, creation: null } } }))
  const directory = source(() => snapshot.currentPath)
  const forge = { options: { id: 'forge-panel.worktree' }, inject: () => ({ hooks: { panel } }) }
  let generation = { id: 1 }
  const connection = { generation: source(() => generation), rpc: { async call(path, endpoint, { args }, signal) {
    assert.equal(path, '/api')
    assert.equal(args.request.sessionId, sessionId)
    calls.push({ endpoint, request: { ...args.request }, signal })
    if (endpoint === 'chatGroups/applyWorktree') {
      await apply?.()
      snapshot = { ...snapshot, currentPath: args.request.path }
    } else {
      assert.equal(endpoint, 'chatGroups/listWorktrees')
      await list?.()
    }
    return { ok: true, value: args.request.recoveryOnly && !snapshot.recovering ? null : snapshot }
  } } }
  const eventListeners = new Set()
  const entries = []
  let eventWindow = { entries, change: { kind: 'replace', entries } }
  const eventSource = { getSnapshot: () => eventWindow, subscribe(fn) { eventListeners.add(fn); return () => eventListeners.delete(fn) } }
  function append(events) {
    const entries = events.map(event => ({ type: 'event', event }))
    eventWindow = { entries: [...eventWindow.entries, ...entries], change: { kind: 'append', entries } }
    for (const listener of eventListeners) listener()
  }
  const sessions = { binding: () => ({ eventSource, session: { ...source(() => lifecycle), projections: { faceOf(key) { assert.equal(key, 'workingDirectory'); return directory } } } }) }
  const workspaceList = source(() => ({ items: [{ workspaceId: 'w', sessionIds: [sessionId] }] }))
  let block
  const blockListeners = new Set()
  const blockStore = { getSnapshot: () => block, subscribe(fn) { blockListeners.add(fn); return () => blockListeners.delete(fn) } }
  const blocks = {
    storeFor: () => blockStore,
    set(id, value) { assert.equal(id, sessionId); block = value; for (const notify of blockListeners) notify() },
  }
  const services = { sessions, connection, uiWorkspace: {}, workspaces: { list: workspaceList }, conversation: { blocks } }
  const ctx = {
    get: id => services[id], remoteAccess: { whenAccess: (_action, callback) => { enable = callback } },
    slots: {
      inject: (name, fn) => [slot, 'conversation.input.dock'].includes(name) ? fn() : () => {},
      register(options, component) { slots.set(options.name, { options, component }); return () => slots.delete(options.name) },
      entriesOfSlot: () => [forge], subscribe: () => () => {},
    },
    locale: { register(id, dict) { copies.set(id, dict); return () => copies.delete(id) } },
    contextMenus: { notify: msg => notices.push(msg) },
  }
  window.__ModuleLoader__ = { load: ({ factory }) => factory(name => name === 'react' ? react : {}).apply(ctx) }
  runInNewContext(client, { window, EventTarget, AbortController })
  const dispose = enable()
  const { options, component } = slots.get(dock ? 'conversation.input.dock' : slot)
  const face = options.inject(sessionId)
  assert.equal(face.hooks.directory, directory)
  const copy = copies.get(options.locale).en
  const t = (key, vars) => copy[key].replace('{commit}', vars?.commit ?? '')
  const props = { sessionId: face.sessionId, useDirectory: selector => selector(directory.getSnapshot()),
    useLifecycle: selector => selector(face.hooks.lifecycle.getSnapshot()),
    useWorkspaces: selector => selector(face.hooks.workspaces.getSnapshot()), t }
  const outer = component(props)
  const inner = dock ? outer?.type(outer.props) : outer
  if (inner) assert.deepEqual(JSON.parse(inner.props.key), [sessionId, 'w', generation.id])
  hooks.length = 0
  let styles
  function render() {
    cursor = 0
    const result = inner?.type(inner.props)
    for (const effect of effects.splice(0)) effect()
    styles = result?.type === 'style' ? result : result?.children?.[0]
    return result?.children?.[1]?.props
  }
  return { render, hidesForge: () => styles?.props?.['data-existing-worktree'] === '', calls, notices, blocks, append, setForge: value => { forgeRequest = value },
    disconnect: () => { generation = undefined },
    dispose() {
      for (const hook of hooks) hook?.value?.cleanup?.()
      dispose()
      assert.equal(slots.size, 0); assert.equal(copies.size, 0)
    },
  }
}

const text = node => typeof node === 'string' ? node : node?.children?.map(text).join(' ') ?? ''

test('hero selector applies an existing worktree to the same session, waits for confirmation and resets', async () => {
  let release
  const f = fixture({ apply: () => new Promise(resolve => { release = resolve }) })
  f.render(); await tick()
  let menu = f.render()
  assert.equal(menu.selectedId, '/repo')
  assert.match(text(menu.items[0].label), /Workspace default directory · main.*\/repo/)
  assert.match(text(menu.items[1].label), /Detached HEAD · abcdef01.*\/topic/)
  assert.match(text(menu.items[2].label), /read-only/)
  assert.equal(menu.items[2].disabled, true)
  await menu.onSelect('/other')
  const changes = () => f.calls.filter(call => call.endpoint.endsWith('/applyWorktree'))
  assert.equal(changes().length, 0)
  const switching = menu.onSelect('/topic')
  f.append([{ type: 'plugin:client-ui-forge/worktree', data: { action: 'cancel' } }])
  assert.match(f.notices[0], /Switch to the workspace default directory/)
  assert.match(f.blocks.storeFor(sessionId).getSnapshot().reason, /Switching worktree/)
  await menu.onSelect('/topic')
  menu = f.render()
  assert.equal(menu.anchor.props['aria-disabled'], true)
  assert.equal(menu.selectedId, '/repo')
  assert.equal(changes().length, 1)
  release(); await switching
  assert.equal(f.blocks.storeFor(sessionId).getSnapshot(), undefined)
  menu = f.render()
  assert.equal(menu.selectedId, '/topic')
  assert.equal(f.hidesForge(), true)
  assert.match(text(menu.anchor), /abcdef01/)
  const reset = menu.onSelect('/repo')
  const foreignBlock = { reason: 'Select a model first' }
  f.blocks.set(sessionId, foreignBlock)
  f.blocks.set(sessionId, undefined)
  assert.match(f.blocks.storeFor(sessionId).getSnapshot().reason, /Switching worktree/)
  f.blocks.set(sessionId, foreignBlock)
  release(); await reset
  assert.equal(f.render().selectedId, '/repo')
  assert.equal(f.hidesForge(), false)
  assert.equal(f.blocks.storeFor(sessionId).getSnapshot(), foreignBlock)
  assert.deepEqual(changes().map(call => call.request), [{ sessionId, path: '/topic' }, { sessionId, path: '/repo' }])
  f.dispose()
})

test('Forge requests close the open picker, and a rejected selection retains the current checkout', async () => {
  const f = fixture({ apply() { throw Error('worktree was removed') } })
  f.render(); await tick()
  f.render().anchor.props.onClick()
  assert.equal(f.render().open, true)
  f.setForge({ from: 'main' })
  let menu = f.render()
  assert.equal(menu.open, false)
  assert.equal(menu.anchor.props['aria-disabled'], true)
  await menu.onSelect('/topic')
  assert.ok(!f.calls.some(call => call.endpoint.endsWith('/applyWorktree')))
  f.setForge(null); menu = f.render()
  assert.equal(menu.open, false)
  await menu.onSelect('/topic'); await tick()
  assert.match(f.notices[0], /worktree was removed/)
  assert.equal(f.render().selectedId, '/repo')
  f.dispose()
})

test('disconnect and unmount release a pending block and discard stale RPC replies', async () => {
  let fail
  const f = fixture({ apply: () => new Promise((_resolve, reject) => { fail = reject }) })
  f.render(); await tick()
  const switching = f.render().onSelect('/topic')
  const call = f.calls.at(-1)
  f.disconnect()
  f.dispose()
  assert.equal(call.signal.aborted, true)
  assert.equal(f.blocks.storeFor(sessionId).getSnapshot(), undefined)
  fail(Error('old transport'))
  await switching
  assert.equal(f.notices.length, 0)
  assert.equal(f.calls.at(-1), call)
})

test('explains a live Forge cancellation even when request and cancel are batched', async () => {
  const f = fixture({ snapshot: { ...initial, currentPath: '/topic' } })
  f.render(); await tick(); f.render()
  f.append(['request', 'cancel'].map(action => ({ type: 'plugin:client-ui-forge/worktree', data: { action } })))
  assert.deepEqual(f.notices, ['New worktree was cancelled. Switch to the workspace default directory before selecting New worktree.'])
  f.dispose()
})

test('can return from a stale worktree to the workspace even when the Git list is empty', async () => {
  const f = fixture({ snapshot: { ...initial, currentPath: '/gone', worktrees: [] } })
  f.render(); await tick()
  const menu = f.render()
  assert.equal(menu.selectedId, '/gone')
  await menu.onSelect('/repo')
  assert.equal(f.calls.find(call => call.endpoint.endsWith('/applyWorktree')).request.path, '/repo')
  assert.equal(f.render(), undefined)
  f.dispose()
})

test('composer dock restores a failed first send and lets the user confirm the current directory', async () => {
  const f = fixture({ dock: true,
    snapshot: { ...initial, recovering: true, worktrees: [] } })
  f.render(); await tick()
  const menu = f.render()
  assert.match(text(menu.anchor), /Select a worktree again/)
  await menu.onSelect('/repo')
  assert.equal(f.calls.find(call => call.endpoint.endsWith('/applyWorktree')).request.path, '/repo')
  assert.match(f.notices[0], /Send your message again/)
  f.dispose()
})

test('failed recovery lookup can be retried in the composer', async () => {
  let attempts = 0
  const f = fixture({ dock: true, snapshot: { ...initial, recovering: true },
    list() { if (++attempts === 1) throw Error('transport interrupted') } })
  f.render(); await tick()
  const retry = f.render()
  assert.match(retry.title, /transport interrupted/)
  await retry.onClick()
  assert.match(text(f.render().anchor), /Select a worktree again/)
  f.dispose()
})

test('dock skips ordinary sessions and respects host recovery eligibility', async () => {
  for (const state of [{ blank: true }, { running: true }, { openState: 'loading' }, {}]) {
    const f = fixture({ dock: true, lifecycle: { openState: 'open', blank: false, running: false, ...state } })
    f.render(); await tick()
    assert.equal(f.render(), undefined)
    assert.deepEqual(f.calls.map(call => call.request), Object.keys(state).length ? [] : [{ sessionId, recoveryOnly: true }])
    f.dispose()
  }
})

test('omits the selector at the default directory without a selectable alternative', async () => {
  for (const worktrees of [[], initial.worktrees.slice(0, 1), initial.worktrees.filter(row => row.path !== '/topic')]) {
    const f = fixture({ snapshot: { ...initial, worktrees } })
    f.render(); await tick()
    assert.equal(f.render(), undefined)
    f.dispose()
  }
})
