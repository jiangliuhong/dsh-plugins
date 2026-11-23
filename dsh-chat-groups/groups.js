import { randomUUID } from 'node:crypto'

export class GroupError extends Error {
  constructor(code, message) {
    super(message)
    this.code = `chat-groups/${code}`
  }
}

export function emptyGroups() {
  return { groups: {}, membership: {}, pendingSessions: {} }
}

function requireGroup(state, workspaceId, groupId) {
  const group = Object.hasOwn(state.groups, groupId) ? state.groups[groupId] : undefined
  if (group === undefined) throw new GroupError('group-missing', '分组已不存在。')
  if (group.workspaceId !== workspaceId) {
    throw new GroupError('workspace-mismatch', '只能在会话所属工作区内分组。')
  }
}

function updateGroups(state, request) {
  const { action, workspaceId, groupId } = request
  if (action === 'create') {
    const group = { workspaceId, name: request.name, createdAt: Date.now() }
    return {
      ...state,
      groups: { ...state.groups, [randomUUID()]: group },
    }
  }
  if (groupId !== null) requireGroup(state, workspaceId, groupId)
  if (action === 'rename') {
    return {
      ...state,
      groups: { ...state.groups, [groupId]: { ...state.groups[groupId], name: request.name } },
    }
  }
  if (action === 'delete') {
    const groups = { ...state.groups }
    delete groups[groupId]
    const membership = Object.fromEntries(
      Object.entries(state.membership).filter(([, memberOf]) => memberOf !== groupId),
    )
    const pendingSessions = { ...state.pendingSessions }
    delete pendingSessions[groupId]
    return { groups, membership, pendingSessions }
  }

  const { sessionId } = request
  const membership = { ...state.membership }
  if (groupId === null) {
    const previous = Object.hasOwn(membership, sessionId) ? membership[sessionId] : undefined
    if (previous !== undefined && state.groups[previous]?.workspaceId !== workspaceId) {
      throw new GroupError('workspace-mismatch', '只能在会话所属工作区内移出分组。')
    }
    delete membership[sessionId]
  } else {
    membership[sessionId] = groupId
  }
  return { ...state, membership }
}

export function createGroupOperations({ read, write, workspace, available, archived, createNativeSession }) {
  let writes = Promise.resolve()
  function inOrder(operation) {
    const task = writes.then(operation)
    writes = task.then(() => {}, () => {})
    return task
  }

  function requireWorkspace(workspaceId) {
    const target = workspace(workspaceId)
    if (target === undefined) throw new GroupError('workspace-missing', '工作区已不存在。')
    return target
  }

  function requireMembership({ workspaceId, sessionId }) {
    if (!requireWorkspace(workspaceId).sessionIds.includes(sessionId)) {
      throw new GroupError('workspace-mismatch', '只能整理当前工作区的会话。')
    }
    if (archived(sessionId)) {
      throw new GroupError('session-archived', '请先在默认视图中取消归档。')
    }
  }

  return {
    snapshot() {
      const state = read()
      const groups = Object.fromEntries(Object.entries(state.groups).filter(
        ([, group]) => workspace(group.workspaceId) !== undefined,
      ))
      const sessionsByWorkspace = new Map()
      const membership = Object.fromEntries(Object.entries(state.membership).filter(([sessionId, groupId]) => {
        if (!Object.hasOwn(groups, groupId)) return false
        const { workspaceId } = groups[groupId]
        if (!sessionsByWorkspace.has(workspaceId)) {
          sessionsByWorkspace.set(workspaceId, new Set(workspace(workspaceId).sessionIds))
        }
        return sessionsByWorkspace.get(workspaceId).has(sessionId)
      }))
      const pendingSessions = Object.fromEntries(Object.entries(state.pendingSessions).filter(
        ([groupId]) => Object.hasOwn(groups, groupId),
      ))
      return { groups, membership, pendingSessions }
    },

    change(request) {
      return inOrder(async () => {
        if (request.action === 'assign') {
          requireMembership(request)
          if (!await available(request.sessionId)) {
            throw new GroupError('session-missing', '会话已不存在。')
          }
          requireMembership(request)
        } else {
          requireWorkspace(request.workspaceId)
        }
        await write(updateGroups(read(), request))
        return this.snapshot()
      })
    },

    createSession({ workspaceId, groupId, retrySessionId }) {
      return inOrder(async () => {
        let state = read()
        const target = requireWorkspace(workspaceId)
        requireGroup(state, workspaceId, groupId)

        function reserve(sessionId) {
          state = { ...state, pendingSessions: { ...state.pendingSessions, [groupId]: sessionId } }
          return write(state)
        }

        let sessionId = state.pendingSessions[groupId]
        if (retrySessionId !== undefined && retrySessionId !== sessionId) {
          if (state.membership[retrySessionId] !== groupId) {
            throw new GroupError('retry-stale', '该会话的归属已变化，请重新加载分组。')
          }
          if (!await available(retrySessionId)) throw new GroupError('session-missing', '会话已不存在。')
          requireMembership({ workspaceId, sessionId: retrySessionId })
          return { state: this.snapshot(), sessionId: retrySessionId }
        }

        // Persist the requested native ID before the first call. A failed
        // workspace attachment can then be retried without calling create.
        if (sessionId === undefined) {
          sessionId = `session-${randomUUID()}`
          await reserve(sessionId)
        }
        if (!await available(sessionId)) {
          const created = await createNativeSession({ workspaceId, sessionId })
          if (created.sessionId !== sessionId) {
            sessionId = created.sessionId
            await reserve(sessionId)
          }
          if (created.attachmentError !== undefined) throw created.attachmentError
        } else if (!target.sessionIds.includes(sessionId)) {
          if (archived(sessionId)) throw new GroupError('session-archived', '请先在默认视图中取消归档。')
          await target.attachSession(sessionId)
        }

        const request = { action: 'assign', workspaceId, groupId, sessionId }
        requireMembership(request)
        const pendingSessions = { ...state.pendingSessions }
        delete pendingSessions[groupId]
        const updated = updateGroups({ ...state, pendingSessions }, request)
        await write(updated)
        return { state: this.snapshot(), sessionId }
      })
    },
  }
}
