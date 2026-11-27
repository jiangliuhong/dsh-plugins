import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorktreeGuard } from '../worktree-guard.js'

function fixture({ initialSelection = null } = {}) {
  const events = []
  const hooks = new Map()
  let cwd = '/project'
  let selected = initialSelection
  let failed = false
  const missing = new Set(['/gone'])
  let maintenance
  const calls = []
  const session = { id: 'session', get seq() { return events.length }, eventAt: i => events[i] }
  function emit(event) {
    events.push(event)
    hooks.get('session/event')(session, event)
  }
  const forge = action => emit({ type: 'plugin:client-ui-forge/worktree', data: { action }, ignorable: true })
  const agent = { session, inbox: { nextTurn: [], nextStep: [] }, runMaintenance(task) {
    if (maintenance) throw Error('busy')
    maintenance = task(new AbortController().signal).finally(() => { maintenance = undefined })
    return maintenance
  } }
  const ctx = {
    on: (name, fn) => hooks.set(name, fn), agents: { get: () => agent },
    workingDirectory: { get: () => cwd }, logger: { warn: message => calls.push(message) },
    get: () => ({ async cancelWorktree() { calls.push('cancel'); forge('cancel') } }),
  }
  const guard = createWorktreeGuard(ctx, {
    getSelection: () => selected,
    setSelection: async (_id, path, failure = false) => { selected = path; failed = failure },
    getRecovery: () => failed, setRecovery: async (_id, failure) => { failed = failure },
    validateSelection: async (_agent, path) => { if (missing.has(path)) throw Error('gone') },
  })
  const apply = (path, fn) => guard.apply(agent, path, async (_signal, beforeSet) => {
    await beforeSet(path)
    await fn?.()
    cwd = path ?? '/project'
    return cwd
  })
  return { apply, forge, emit, calls, agent, missing, selected: () => selected, maintenance: () => maintenance,
    recovering: () => guard.recovering(session),
    run: (event, next, path = null) => hooks.get(event)({ agent, path, signal: new AbortController().signal }, next) }
}

test('selection persists before cwd mutation, rolls back a failed set, and default clears the guard', async () => {
  const f = fixture()
  await f.apply('/existing', () => assert.equal(f.selected(), '/existing'))
  await assert.rejects(f.apply('/other', () => { throw Error('set failed') }), /set failed/)
  assert.equal(f.selected(), '/existing')
  await f.apply(null, () => assert.equal(f.selected(), '/existing'))
  assert.equal(f.selected(), null)
})

test('missing selection prevents native cwd fallback and first step, unrelated sessions pass through', async () => {
  const f = fixture()
  assert.equal(await f.run('working-directory/access', async () => '/project'), '/project')
  await f.apply('/gone')
  const unexpected = () => assert.fail('invalid worktree entered native fallback or model step')
  await assert.rejects(f.run('working-directory/access', unexpected), /gone/)
  await assert.rejects(f.run('agent/pre-step', async () => ({ kind: 'enter' })), /gone/)
})

test('Forge wins when already requested; selected worktree withdraws a subsequent Forge request', async () => {
  const f = fixture()
  f.forge('request')
  await assert.rejects(f.apply('/existing'), /取消「新建工作树」/)
  f.forge('cancel')
  await f.apply('/existing')
  f.forge('request')
  assert.ok(f.maintenance(), 'selection reserves the wake until Forge cancellation')
  await f.maintenance()
  assert.deepEqual(f.calls, ['cancel'])
  assert.equal(f.selected(), '/existing')
})

test('a failed switch blocks a queued send, and a first-tool failure keeps recovery available after turn/end', async () => {
  const f = fixture()
  await assert.rejects(f.apply('/existing', () => {
    f.agent.inbox.nextTurn.push({ source: { kind: 'user' } })
    throw Error('checkout disappeared')
  }), /checkout disappeared/)
  await assert.rejects(f.run('agent/pre-step', () => assert.fail()), /checkout disappeared/)
  await f.apply('/existing')
  assert.equal(await f.run('agent/pre-step', async () => 'enter'), 'enter')
  f.emit({ type: 'turn/start' })
  f.emit({ type: 'step/start' })
  assert.equal(f.selected(), '/existing')
  await assert.rejects(f.apply('/other'), /会话已开始/)
  f.missing.add('/existing')
  // A read/bash during this step must fail before native ensure commits its fallback.
  await assert.rejects(f.run('working-directory/access', () => assert.fail('used fallback')), /gone/)
  f.emit({ type: 'step/end' })
  assert.equal(f.selected(), '/existing')
  f.emit({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  // A tool failure may be contained and the model may end the turn normally.
  assert.equal(f.selected(), '/existing')
  assert.equal(f.recovering(), true)
  await assert.rejects(f.apply('/other', () => { throw Error('set failed') }), /set failed/)
  assert.equal(f.selected(), '/existing')
  assert.equal(f.recovering(), true)
  await f.apply(null)
  assert.equal(f.recovering(), false)
  assert.equal(await f.run('working-directory/access', () => '/project'), '/project')
})

test('an explicit cd during the first tool batch releases protection only after a successful directory change', async () => {
  const f = fixture()
  await f.apply('/existing')
  f.emit({ type: 'turn/start' })
  f.emit({ type: 'step/start' })
  await assert.rejects(f.run('working-directory/access', async () => { throw Error('directory missing') }, 'missing'), /directory missing/)
  assert.equal(f.selected(), '/existing')
  assert.equal(await f.run('working-directory/access', () => '/existing/subdir', 'subdir'), '/existing/subdir')
  assert.equal(f.selected(), null)
  assert.equal(await f.run('working-directory/access', () => '/existing/subdir'), '/existing/subdir')
})

test('a native ensure failure during the tool batch preserves recovery even if Git validation succeeded', async () => {
  const f = fixture()
  await f.apply('/existing')
  f.emit({ type: 'turn/start' })
  f.emit({ type: 'step/start' })
  await assert.rejects(f.run('working-directory/access', async () => { throw Error('directory just removed') }), /just removed/)
  f.emit({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  assert.equal(f.recovering(), true)
})

test('interrupted directory change at restart permits reconfirming the current default', async () => {
  const f = fixture({ initialSelection: '/existing' })
  assert.equal(f.recovering(), true)
  await assert.rejects(f.run('working-directory/access', () => assert.fail()), /重新选择/)
  await f.apply(null)
  assert.equal(f.recovering(), false)
  assert.equal(await f.run('working-directory/access', () => '/project'), '/project')
})
