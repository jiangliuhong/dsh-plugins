import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { existingWorktrees, parseWorktrees, validateSelection } from '../existing-worktrees.js'
import { createWorktreeGuard } from '../worktree-guard.js'

const root = resolve('example-repo')
const linked = resolve(root, 'worktrees', 'topic')
const external = resolve(root + '-external')
const outside = resolve(root + '-spoof')
const commit = '1234567890abcdef'
const porcelain = (path, suffix) => `worktree ${path}\0HEAD ${commit}\0${suffix}\0\0`

function fixture() {
  const session = { id: 's', header: { cwd: root } }
  const workspace = { id: 'w', path: root, sessionIds: ['s'] }
  const agent = { session }
  const model = {
    cwd: root, blank: true, inbox: [], forge: undefined, mode: 'workspace-write', extra: [],
    archived: [], source: `${root}/.git`, target: `${root}/.git`, missing: [],
    listing: porcelain(root, 'branch refs/heads/main') + porcelain(linked, 'detached') + porcelain(external, 'branch refs/heads/topic'),
  }
  let sets = 0
  const ctx = {
    agents: { get: id => id === 's' ? agent : undefined },
    workspaceRegistry: { list: () => [workspace], get archivedSessionIds() { return model.archived } },
    sessionProjections: {
      snapshot: () => ({ values: { sessionListMetadata: { blank: model.blank }, inbox: { 'next-turn': model.inbox, 'next-step': [] } } }),
      stateOf: () => model.forge,
    },
    workingDirectory: { get: () => model.cwd, set: async (_agent, path) => {
      sets++
      model.inbox.push({ source: { kind: 'working-directory' } })
      return model.cwd = path
    } },
    fs: { resolve: async path => path, stat: async path => model.missing.includes(path) ? null : { type: 'directory' }, processPath: path => path },
    sandboxPolicy: { resolve: () => ({ mode: model.mode, workspaceRoot: root, additionalWritableRoots: model.extra }) },
    sandbox: { confine: async (argv, policy) => { assert.equal(policy.mode, model.mode); return { argv: ['confined', ...argv] } } },
    subprocess: {
      resolveExecutable: async () => 'git',
      spawn({ argv, cwd, env }) {
        if (model.mode !== 'danger-full-access') assert.equal(argv[0], 'confined')
        assert.equal(env.GIT_DIR, undefined)
        let text, exitCode = 0, diagnostic = ''
        if (argv.includes('list')) {
          if (model.listing === null) { exitCode = 128; diagnostic = 'fatal: not a git repository' }
          text = model.listing ?? ''
        } else if (argv.includes('--show-toplevel')) text = cwd + '\n'
        else if (argv.includes('--git-common-dir')) text = (cwd === root ? model.source : model.target) + '\n'
        else assert.fail('unexpected git arguments')
        return { done: Promise.resolve({ exitCode }), terminate() {}, async waitForExit() {}, collected: {
          stdout: { readFrom: () => ({ text, lossy: false }) }, stderr: { readFrom: () => ({ text: diagnostic }) },
        } }
      },
    },
  }
  const signal = new AbortController().signal
  const guard = { recovering: () => false, async apply(given, requested, operation) {
    assert.equal(given, agent)
    const before = sets
    let prepared = false
    const cwd = await operation(signal, async selection => {
      assert.equal(sets, before)
      assert.equal(selection, requested === root ? null : requested)
      prepared = true
    })
    assert.equal(prepared, true)
    return cwd
  } }
  return { ctx, agent, signal, model, sets: () => sets, apply: path => existingWorktrees(ctx, { sessionId: 's', path }, guard) }
}

test('NUL-separated Git records preserve odd paths and skip bare and stale checkouts', () => {
  const odd = resolve(root, 'branch with\na line')
  assert.deepEqual(parseWorktrees(porcelain(odd, 'branch refs/heads/a/b') + `worktree ${root}\0bare\0\0` + porcelain(linked, 'prunable gitdir gone')), [
    { path: odd, commit, branch: 'a/b' },
  ])
})

test('lists, applies and resets the current session while honoring standing permissions', async () => {
  const { apply, model, sets } = fixture()
  const first = await apply()
  assert.equal(first.defaultPath, root)
  assert.equal(first.editable, true)
  assert.deepEqual(first.worktrees.map(r => [r.branch, r.selectable]), [['main', true], [null, true], ['topic', false]])
  assert.equal((await apply(linked)).currentPath, linked)
  await assert.rejects(apply(external), { code: 'chat-groups/worktree-denied' })
  await assert.rejects(apply(outside), { code: 'chat-groups/worktree-missing' })
  model.mode = 'read-only'
  await assert.rejects(apply(linked), { code: 'chat-groups/worktree-denied' })
  assert.equal((await apply(root)).currentPath, root)
  assert.equal(sets(), 2)
  model.listing = null
  assert.deepEqual((await apply()).worktrees, [])
})

test('rejects stale directories, unmatched repository identity and revoked grants', async () => {
  const { apply, model, ctx, agent, signal, sets } = fixture()
  model.target = `${outside}/.git`
  await assert.rejects(apply(linked), { code: 'chat-groups/worktree-missing' })
  model.missing = [linked]
  assert.ok(!(await apply()).worktrees.some(r => r.path === linked))
  model.target = model.source
  model.missing = []
  model.mode = 'danger-full-access'
  assert.equal((await apply(external)).currentPath, external)
  model.mode = 'workspace-write'
  await assert.rejects(validateSelection(ctx, agent, external, signal), { code: 'chat-groups/worktree-denied' })
  if (process.platform !== 'win32') {
    model.extra = [external]
    await validateSelection(ctx, agent, external, signal)
  }
  assert.equal(sets(), 1)
})

test('rechecks Forge while allowing a prompt queued after maintenance began', async () => {
  for (const conflict of ['forge', 'prompt']) {
    const { apply, ctx, model, sets } = fixture()
    const spawn = ctx.subprocess.spawn
    ctx.subprocess.spawn = request => {
      if (request.argv.includes('--git-common-dir')) {
        if (conflict === 'forge') model.forge = { request: { from: null } }
        else model.inbox.push({ source: { kind: 'user' } })
      }
      return spawn(request)
    }
    if (conflict === 'forge') {
      await assert.rejects(apply(linked), { code: 'chat-groups/session-busy' })
      assert.equal(sets(), 0)
    } else {
      const result = await apply(linked)
      assert.equal(result.currentPath, linked)
      assert.equal(result.editable, false)
      assert.equal(sets(), 1)
    }
  }
})

test('denies started, queued, archived, child and Forge-managed sessions', async () => {
  const { apply, model, agent, sets } = fixture()
  for (const [field, value] of [['blank', false], ['inbox', [{}]], ['forge', { request: {} }], ['forge', { created: {} }]]) {
    const before = model[field]
    model[field] = value
    assert.equal((await apply()).editable, false)
    await assert.rejects(apply(linked), { code: 'chat-groups/session-busy' })
    model[field] = before
  }
  model.archived = ['s']
  await assert.rejects(apply(linked), { code: 'chat-groups/workspace-missing' })
  agent.session.header.origin = 'subagent'
  await assert.rejects(apply(), { code: 'chat-groups/session-unavailable' })
  assert.equal(sets(), 0)
})

test('list and apply both resume a persisted active session and recheck membership after resume', async () => {
  for (const request of [undefined, linked]) {
    const { apply, ctx, agent, model } = fixture()
    let live, resumes = 0
    ctx.agents.get = () => live
    ctx.sessionController = { async resolveAgent(id) {
      assert.equal(id, 's')
      resumes++
      live = agent
      return { agent }
    } }
    assert.equal((await apply(request)).currentPath, request ?? root)
    assert.equal(resumes, 1)
    live = undefined
    ctx.sessionController.resolveAgent = async () => { live = agent; model.archived = ['s']; return { agent } }
    await assert.rejects(apply(request), { code: 'chat-groups/workspace-missing' })
    live = undefined
    ctx.sessionController.resolveAgent = () => assert.fail('resumed archived session')
    await assert.rejects(apply(request), { code: 'chat-groups/workspace-missing' })
  }
})

test('after a pre-model failure and Host restart, the same nonblank session can reset or reselect and retry', async () => {
  for (const replacement of [root, linked]) {
    const { ctx, agent, model, signal } = fixture()
    const events = [], hooks = new Map()
    let selection, failed = false
    Object.defineProperty(agent.session, 'seq', { get: () => events.length })
    agent.session.eventAt = i => events[i]
    agent.inbox = { nextTurn: [], nextStep: [] }
    agent.runMaintenance = fn => fn(signal)
    ctx.on = (event, fn) => hooks.set(event, fn)
    const mount = () => createWorktreeGuard(ctx, {
      getSelection: () => selection,
      setSelection: async (_id, path, failure = false) => { selection = path; failed = failure },
      getRecovery: () => failed, setRecovery: async (_id, failure) => { failed = failure },
      validateSelection: (a, path, control) => validateSelection(ctx, a, path, control),
    })
    let guard = mount()
    const act = path => existingWorktrees(ctx, { sessionId: 's', path }, guard)
    const emit = (type, data) => {
      events.push({ type, data })
      hooks.get('session/event')(agent.session, events.at(-1))
    }
    const ensure = () => hooks.get('working-directory/access')({ agent, path: null, signal }, () => model.cwd)
    await act(linked)
    emit('turn/start', { turn: 1 })
    model.blank = false
    model.forge = { locked: true, created: null, request: null }
    model.inbox = [] // DSH claims the first send before assembling the system prompt.
    model.listing = null
    await assert.rejects(ensure(), { code: 'chat-groups/worktree-missing' })
    emit('turn/end', { turn: 1, reason: { kind: 'error', error: { message: '工作树已变化，请重新选择。' } } })
    guard = mount()
    const probe = () => existingWorktrees(ctx, { sessionId: 's', recoveryOnly: true }, guard)
    const retry = await probe()
    assert.equal(retry.editable, true)
    for (const conflict of [{ request: {} }, { created: {} }, { restoring: true }]) {
      model.forge = { locked: true, ...conflict }
      assert.equal((await probe()).editable, false)
      await assert.rejects(act(replacement), { code: 'chat-groups/session-busy' })
    }
    model.forge = { locked: true }
    assert.equal(retry.recovering, true)
    assert.deepEqual(retry.worktrees, [])
    if (replacement === linked) model.listing = porcelain(root, 'branch refs/heads/main') + porcelain(linked, 'detached')
    assert.equal((await act(replacement)).currentPath, replacement)
    emit('turn/start', { turn: 2 })
    assert.equal(await ensure(), replacement)
    emit('step/start', { turn: 2, step: 1 })
    assert.equal(await ensure(), replacement)
    emit('step/end', { turn: 2, step: 1 })
    emit('turn/end', { turn: 2, reason: { kind: 'completed' } })
    assert.equal((await act()).editable, false)
    assert.equal(selection, null)
    ctx.agents.get = () => assert.fail('an ordinary session should not be looked up or resumed')
    ctx.subprocess.spawn = () => assert.fail('an ordinary session should not enumerate worktrees')
    assert.equal(await probe(), null)
  }
})
