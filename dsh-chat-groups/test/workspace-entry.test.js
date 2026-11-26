import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const tick = () => new Promise(resolve => setImmediate(resolve))

function loadClient({ snapshot, selector, fork, inherit } = {}) {
  const calls = []
  const notices = []
  let definition
  const window = { __ModuleLoader__: { load({ factory }) {
    definition = factory(name => name === 'react' ? { createElement: () => null } : {})
  } } }
  runInNewContext(client, { window, console, EventTarget, Event, AbortController })
  const uiWorkspace = Object.create({ createInWorkspace: selector ?? (view => view.sessionIds) })
  const sessions = Object.create({ fork: fork ?? (async () => 'child') })
  const connection = { rpc: { async call(path, endpoint, { args }) {
    assert.equal(path, '/api')
    if (endpoint === 'chatGroups/snapshot') return { ok: true, value: await snapshot() }
    assert.equal(endpoint, 'chatGroups/inheritForkGroup')
    const request = { ...args.request }
    calls.push(request)
    await inherit?.(request)
    return { ok: true }
  } } }
  const services = { uiWorkspace, sessions, workspaces: {}, connection }
  let onAccess
  const ctx = {
    get: name => services[name],
    remoteAccess: { whenAccess(endpoint, cb) { assert.equal(endpoint, 'chatGroups/snapshot'); onAccess = cb } },
    slots: { inject: (_slot, register) => register(), register: () => () => {} },
    contextMenus: { notify: text => notices.push(text) },
  }
  definition.apply(ctx)
  const enable = () => onAccess()
  return { uiWorkspace, sessions, enable, calls, notices }
}

test('workspace selection preserves receiver, preset, candidate order and original scope', async () => {
  const options = { agentPreset: 'review' }
  const workspace = Object.freeze({ workspaceId: 'w', path: '/project', sessionIds: Object.freeze(['grouped', 'b', 'pending', 'a']) })
  const state = { membership: { grouped: 'g' }, pendingSessions: { h: 'pending' } }
  const { uiWorkspace, enable } = loadClient({ snapshot: () => state, selector(view, nativeOptions) {
    assert.equal(this, uiWorkspace)
    assert.equal(nativeOptions, options)
    assert.equal(view.workspaceId, workspace.workspaceId)
    assert.equal(view.path, workspace.path)
    return view.sessionIds
  } })
  const dispose = enable()
  assert.deepEqual(await uiWorkspace.createInWorkspace(workspace, options), ['b', 'a'])
  assert.deepEqual(workspace.sessionIds, ['grouped', 'b', 'pending', 'a'])
  dispose()
  assert.equal(await uiWorkspace.createInWorkspace(workspace, options), workspace.sessionIds)
  assert.equal(Object.hasOwn(uiWorkspace, 'createInWorkspace'), false)
})

test('unknown membership or only grouped candidates results in a fresh workspace blank', async () => {
  let unavailable = false
  const { uiWorkspace, enable } = loadClient({ snapshot() {
    if (unavailable) throw Error('snapshot unavailable')
    return { membership: { grouped: 'g' }, pendingSessions: {} }
  } })
  const dispose = enable()
  const workspace = { sessionIds: ['grouped'] }
  assert.equal((await uiWorkspace.createInWorkspace(workspace)).length, 0)
  unavailable = true
  assert.equal((await uiWorkspace.createInWorkspace(workspace)).length, 0)
  dispose()
})

test('concurrent native forks correlate exact IDs and callbacks, then restore on unload', async () => {
  const requests = new Map()
  const callbacks = []
  const { sessions, calls, enable } = loadClient({ fork(options) {
    assert.equal(this, sessions)
    assert.equal(options.atSeq, 18)
    return new Promise(resolve => requests.set(options.sessionId, childId => {
      options.onCreated(childId)
      resolve(childId)
    }))
  } })
  const start = id => sessions.fork({ sessionId: id, atSeq: 18, onCreated: child => callbacks.push(child) })
  const dispose = enable()
  const first = start('a')
  const second = start('b')
  requests.get('b')('two')
  requests.get('a')('one')
  assert.deepEqual(await Promise.all([first, second]), ['one', 'two'])
  assert.deepEqual(calls, [{ sourceSessionId: 'b', childSessionId: 'two' }, { sourceSessionId: 'a', childSessionId: 'one' }])
  dispose()
  assert.equal(Object.hasOwn(sessions, 'fork'), false)
  const third = start('c')
  requests.get('c')('three')
  assert.equal(await third, 'three')
  assert.deepEqual(callbacks, ['two', 'one', 'three'])
  assert.equal(calls.length, 2)
})

test('native fork failures propagate and a grouping failure leaves a created child usable', async () => {
  const nativeFailure = Error('fork failed')
  const { sessions, enable, notices, calls } = loadClient({ async fork(options) {
    if (options.sessionId === 'failing') throw nativeFailure
    options.onCreated('child')
    return 'child'
  }, inherit() { throw Error('storage offline') } })
  const dispose = enable()
  await assert.rejects(sessions.fork({ sessionId: 'failing' }), err => err === nativeFailure)
  assert.equal(calls.length, 0)
  assert.equal(await sessions.fork({ sessionId: 'created' }), 'child')
  await tick()
  assert.equal(calls.length, 1)
  assert.equal(notices.length, 1)
  assert.match(notices[0], /storage offline/)
  dispose()
})
