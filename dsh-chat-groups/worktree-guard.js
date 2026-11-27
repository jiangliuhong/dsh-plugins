import { GroupError } from './groups.js'

const forgeRecord = 'plugin:client-ui-forge/worktree'
const conflict = () => new GroupError('worktree-conflict', '请先取消「新建工作树」，再选择已有工作树。')
const mismatch = () => new GroupError('worktree-changed', '所选工作树已变化，请重新选择工作树。')

// DSH publishes the request and cancel records before the first turn starts.
// The wire projection only exposes the created checkout, not an open request.
function startupState(session, selected, failed) {
  let requested
  let started = false
  let lastEnd
  for (let seq = session.seq - 1; seq >= 0; seq--) {
    const event = session.eventAt(seq)
    if (event?.type === 'step/start') return { started: true, recoverable: !!lastEnd && failed, requested }
    if (!started && lastEnd === undefined && event?.type === 'turn/end') lastEnd = event.data.reason
    if (event?.type === 'turn/start') {
      started = true
      if (!lastEnd) return { started, recoverable: false }
      if (failed) return { started, recoverable: true, requested }
      if (!selected || lastEnd.kind !== 'error') return { started, recoverable: false }
    }
    if (requested === undefined && event?.type === forgeRecord && event.ignorable === true) {
      if (event.data.action === 'request') requested = true
      if (event.data.action === 'cancel') requested = false
    }
  }
  // A failed first admission has turn/start and turn/end, but no model step.
  // Recover this draft even after Host restart, without reopening an ordinary chat.
  return { started, recoverable: started && !!selected, requested }
}

export function createWorktreeGuard(ctx, { getSelection, setSelection, getRecovery, setRecovery, validateSelection }) {
  const applying = new WeakSet()
  const rejectedSend = new WeakMap()

  function checkDirectory(session, expected) {
    if (ctx.workingDirectory.get(session) !== expected) throw mismatch()
  }

  function status(session, selected) {
    return startupState(session, selected, getRecovery(session.id) || (!!selected && ctx.workingDirectory.get(session) !== selected))
  }

  async function checkSelection(agent, selected, signal, ensure) {
    try {
      checkDirectory(agent.session, selected)
      await validateSelection(agent, selected, signal)
      checkDirectory(agent.session, selected)
      if (ensure) {
        const actual = await ensure()
        if (actual !== selected) throw mismatch()
        return actual
      }
    } catch (error) {
      if (!signal.aborted && !getRecovery(agent.session.id)) await setRecovery(agent.session.id, true)
      throw error
    }
  }

  function stepInCurrentTurn(session) {
    for (let seq = session.seq - 1; seq >= 0; seq--) {
      const type = session.eventAt(seq)?.type
      if (type === 'step/start') return true
      if (type === 'turn/start') return false
    }
    return false
  }

  ctx.on('working-directory/access', async ({ agent, path, signal }, next) => {
    const session = agent.session
    const selected = getSelection(session.id)
    if (!selected) return next()
    if (path !== null) {
      // An explicit, successful cd during tool execution supersedes the launch
      // selection. workingDirectory serializes subsequent ensure() calls here.
      const actual = await next()
      if (actual !== selected && !applying.has(session) && stepInCurrentTurn(session)) {
        await setSelection(session.id, null)
      }
      return actual
    }
    return checkSelection(agent, selected, signal, next)
  }, { prepend: true })

  // Core assembles the system prompt before pre-step. This final gate catches
  // a late disappearance or cwd change before the provider receives the batch.
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    const session = agent.session
    const failed = rejectedSend.get(session)
    if (failed) {
      rejectedSend.delete(session)
      await setRecovery(session.id, true)
      throw failed
    }
    const selected = getSelection(session.id)
    if (!selected) {
      if (getRecovery(session.id)) throw mismatch()
      return next()
    }
    const decision = await next()
    await checkSelection(agent, selected, signal)
    // A restored checkout can be retried directly. A new access failure in
    // this step sets the flag again before the turn can finish.
    if (getRecovery(session.id)) await setRecovery(session.id, false)
    return decision
  }, { prepend: true })

  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/end' && getSelection(session.id) && !getRecovery(session.id) && stepInCurrentTurn(session)) {
      // DSH emits step/start before the provider and tool batch execute. Keep
      // the guard through every tool in this turn, including parallel calls.
      void setSelection(session.id, null).catch(error => ctx.logger.warn(String(error)))
    } else if (event.type === forgeRecord && event.ignorable === true && event.data.action === 'request'
        && (applying.has(session) || getSelection(session.id))) {
      // Appends during Session publication are forbidden. Before the next
      // transport callback, withdraw through Forge's own public operation.
      const cancel = async signal => {
        await Promise.resolve()
        const forge = ctx.get('forgePanel')
        if (forge && (applying.has(session) || getSelection(session.id))) await forge.cancelWorktree(session, signal)
      }
      const agent = ctx.agents.get(session.id)
      let cancellation
      try {
        // Reserve before even a same-tick inbox insertion can start Forge's
        // creation hold. A selection already in maintenance owns this phase.
        if (agent && !applying.has(session)) cancellation = agent.runMaintenance(cancel)
      } catch {
        // Another maintenance owner already holds the wake.
      }
      void (cancellation ?? cancel(new AbortController().signal)).catch(error => ctx.logger.warn(String(error)))
    }
  })

  return {
    hasIntent(sessionId) { return !!getSelection(sessionId) || getRecovery(sessionId) },
    recovering(session) {
      const selected = getSelection(session.id)
      if (!selected && !getRecovery(session.id)) return false
      const state = status(session, selected)
      if (state.started) return state.recoverable
      return getRecovery(session.id) || selected !== ctx.workingDirectory.get(session)
    },
    apply(agent, requestedPath, operation) {
      const session = agent.session
      return agent.runMaintenance(async signal => {
        const previous = getSelection(session.id)
        const previouslyFailed = getRecovery(session.id)
        const state = status(session, previous)
        if (state.started && !state.recoverable) throw new GroupError('session-started', '会话已开始，无法选择启动工作树。')
        if (state.requested) throw conflict()
        const previousCwd = ctx.workingDirectory.get(session)
        let prepared = false
        let selection = requestedPath
        applying.add(session)
        try {
          const actual = await operation(signal, async path => {
            if (status(session, previous).requested) throw conflict()
            selection = path
            // Keep the old guard while restoring the default. A crash between
            // storage and the directory log then fails closed in either order.
            if (path !== null) await setSelection(session.id, path, previouslyFailed || state.recoverable)
            prepared = true
          })
          if (!prepared || (selection !== null && actual !== selection)) throw mismatch()
          if (selection === null) await setSelection(session.id, null)
          else if (getRecovery(session.id)) await setRecovery(session.id, false)
          rejectedSend.delete(session)
          return actual
        } catch (error) {
          if (prepared && selection !== null && ctx.workingDirectory.get(session) === previousCwd) {
            await setSelection(session.id, previous, previouslyFailed)
          }
          if ([...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(m => m.source.kind === 'user')) {
            rejectedSend.set(session, error)
          }
          throw error
        } finally {
          applying.delete(session)
        }
      })
    },
  }
}
