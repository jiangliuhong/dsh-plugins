import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroupOperations } from '../groups.js'

function fixture() {
  let state = {
    groups: {
      a: { workspaceId: 'one', name: 'A' },
      b: { workspaceId: 'one', name: 'B' },
      c: { workspaceId: 'two', name: 'C' },
    },
    membership: { first: 'a', second: 'b' },
    pendingSessions: {},
  }
  const workspaces = {
    one: { sessionIds: ['first', 'second'] },
    two: { sessionIds: ['third'] },
  }
  const available = new Set(['first', 'second', 'third'])
  const archived = new Set()
  let failWrite = () => false
  let attachmentError
  const nativeCreates = []
  const commits = []
  const ports = {
    read: () => structuredClone(state),
    write: async next => {
      if (failWrite(next)) throw new Error('write failed')
      commits.push(next)
      state = structuredClone(next)
    },
    workspace: id => workspaces[id],
    available: async id => available.has(id),
    archived: id => archived.has(id),
    async createNativeSession({ workspaceId, sessionId }) {
      nativeCreates.push(sessionId)
      available.add(sessionId)
      if (attachmentError) return { sessionId, attachmentError }
      await workspaces[workspaceId].attachSession(sessionId)
      return { sessionId }
    },
  }
  for (const workspace of Object.values(workspaces)) {
    workspace.attachSession = async sessionId => { workspace.sessionIds.push(sessionId) }
  }
  const reopen = () => createGroupOperations(ports)
  return {
    operations: reopen(), reopen, workspaces, available, archived, commits, nativeCreates,
    failWrites: predicate => { failWrite = predicate },
    failAttachment: error => { attachmentError = error },
  }
}

const assign = (groupId, sessionId = 'first', workspaceId = 'one') => ({
  action: 'assign', workspaceId, sessionId, groupId,
})

test('move and remove preserve one membership per session', async () => {
  const { operations } = fixture()
  assert.deepEqual((await operations.change(assign('b'))).membership, { first: 'b', second: 'b' })
  assert.deepEqual((await operations.change(assign(null))).membership, { second: 'b' })
  assert.deepEqual((await operations.change(assign('a'))).membership, { first: 'a', second: 'b' })
})

test('delete commits the group and all its membership removals together', async () => {
  const { operations, commits } = fixture()
  await operations.change(assign('a', 'second'))
  const snapshot = await operations.change({ action: 'delete', workspaceId: 'one', groupId: 'a' })
  assert.equal(commits.length, 2)
  assert.deepEqual(commits[1], snapshot)
  assert.deepEqual(snapshot.membership, {})
  assert.deepEqual(Object.keys(snapshot.groups), ['b', 'c'])
})

test('reject cross-workspace changes, archived sessions, and missing entities', async () => {
  const { operations, available, archived, commits } = fixture()
  await assert.rejects(operations.change(assign('c')), { code: 'chat-groups/workspace-mismatch' })
  await assert.rejects(operations.change(assign('c', 'first', 'two')), { code: 'chat-groups/workspace-mismatch' })
  await assert.rejects(operations.change(assign('missing')), { code: 'chat-groups/group-missing' })
  await assert.rejects(operations.change({ action: 'delete', workspaceId: 'missing', groupId: 'a' }),
    { code: 'chat-groups/workspace-missing' })
  archived.add('first')
  await assert.rejects(operations.change(assign(null)), { code: 'chat-groups/session-archived' })
  available.delete('second')
  await assert.rejects(operations.change(assign('a', 'second')), { code: 'chat-groups/session-missing' })
  assert.equal(commits.length, 0)
})

test('hide mappings whose workspace or session is no longer in the registry projection', () => {
  const { operations, workspaces } = fixture()
  workspaces.one.sessionIds = ['second']
  delete workspaces.two
  const snapshot = operations.snapshot()
  assert.deepEqual(Object.keys(snapshot.groups), ['a', 'b'])
  assert.deepEqual(snapshot.membership, { second: 'b' })
})

test('rename and membership writes serialize even when called concurrently', async () => {
  const { operations } = fixture()
  const [, , result] = await Promise.all([
    operations.change({ action: 'rename', workspaceId: 'one', groupId: 'a', name: 'Renamed' }),
    operations.change(assign('b')),
    operations.change(assign('a', 'second')),
  ])
  assert.equal(result.groups.a.name, 'Renamed')
  assert.deepEqual(result.membership, { first: 'b', second: 'a' })
})

test('a failed commit leaves the previous state and permits retrying the same session', async () => {
  const { operations, failWrites } = fixture()
  failWrites(() => true)
  await assert.rejects(operations.change(assign('b')), /write failed/)
  assert.equal(operations.snapshot().membership.first, 'a')
  failWrites(() => false)
  assert.equal((await operations.change(assign('b'))).membership.first, 'b')
})

test('finish a failed membership write after reopening using the same native session', async () => {
  const { operations, reopen, failWrites, nativeCreates } = fixture()
  const request = { workspaceId: 'one', groupId: 'a' }
  failWrites(next => next.pendingSessions.a === undefined)
  await assert.rejects(operations.createSession(request), /write failed/)
  const [sessionId] = nativeCreates
  assert.equal(operations.snapshot().pendingSessions.a, sessionId)

  failWrites(() => false)
  const reloaded = reopen()
  const retry = { ...request, retrySessionId: sessionId }
  const result = await reloaded.createSession(retry)
  assert.equal(result.sessionId, sessionId)
  assert.equal(result.state.membership[sessionId], 'a')
  assert.deepEqual(result.state.pendingSessions, {})
  assert.deepEqual(await reloaded.createSession(retry), result)
  assert.deepEqual(nativeCreates, [sessionId])
})

test('reattach a native session reported by a partial create without creating again', async () => {
  const { operations, reopen, workspaces, nativeCreates, failAttachment } = fixture()
  const request = { workspaceId: 'one', groupId: 'a' }
  failAttachment(new Error('native workspace attach failed'))
  await assert.rejects(operations.createSession(request), /native workspace attach failed/)
  const [sessionId] = nativeCreates
  assert.equal(workspaces.one.sessionIds.includes(sessionId), false)
  assert.equal(reopen().snapshot().pendingSessions.a, sessionId)

  const result = await reopen().createSession({ ...request, retrySessionId: sessionId })
  assert.equal(workspaces.one.sessionIds.includes(sessionId), true)
  assert.equal(result.state.membership[sessionId], 'a')
  assert.deepEqual(result.state.pendingSessions, {})
  assert.deepEqual(nativeCreates, [sessionId])
})

test('reject a pending session retry in another workspace or after archive', async () => {
  const { operations, nativeCreates, failAttachment, archived } = fixture()
  failAttachment(new Error('native workspace attach failed'))
  await assert.rejects(operations.createSession({ workspaceId: 'one', groupId: 'a' }), /native workspace attach failed/)
  const [sessionId] = nativeCreates
  const retry = { groupId: 'a', retrySessionId: sessionId }
  await assert.rejects(operations.createSession({ ...retry, workspaceId: 'two' }), {
    code: 'chat-groups/workspace-mismatch',
  })
  archived.add(sessionId)
  await assert.rejects(operations.createSession({ ...retry, workspaceId: 'one' }), {
    code: 'chat-groups/session-archived',
  })
  assert.deepEqual(nativeCreates, [sessionId])
})

test('create adds a group to its workspace while preserving existing groups and sessions', async () => {
  const { operations, reopen } = fixture()
  const before = Date.now()
  const result = await operations.change({ action: 'create', workspaceId: 'two', name: 'New group' })
  const [groupId, group] = Object.entries(result.groups).find(([key]) => !['a', 'b', 'c'].includes(key))
  assert.match(groupId, /^[0-9a-f-]{36}$/)
  assert.equal(group.workspaceId, 'two')
  assert.equal(group.name, 'New group')
  assert.ok(group.createdAt >= before && group.createdAt <= Date.now())
  assert.deepEqual(result.membership, { first: 'a', second: 'b' })

  await operations.change({ action: 'rename', workspaceId: 'two', groupId, name: 'Renamed' })
  assert.deepEqual(reopen().snapshot().groups[groupId], { ...group, name: 'Renamed' })
})
