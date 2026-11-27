import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { GroupError } from './groups.js'

const gitEnv = Object.fromEntries([
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT',
  'GIT_CEILING_DIRECTORIES', 'GIT_PREFIX', 'GIT_SHALLOW_FILE', 'GIT_GRAFT_FILE',
].map(key => [key, undefined]))

// Porcelain -z leaves whitespace, quotes and newlines in paths unescaped.
export function parseWorktrees(text) {
  const worktrees = []
  for (const record of text.split('\0\0')) {
    const fields = record.split('\0')
    const field = prefix => fields.find(value => value.startsWith(prefix))?.slice(prefix.length)
    const path = field('worktree ')
    const commit = field('HEAD ')
    if (!path || !isAbsolute(path) || !commit || fields.some(value => value === 'prunable' || value.startsWith('prunable '))) continue
    worktrees.push({ path: normalize(path), commit, branch: field('branch refs/heads/') ?? null })
  }
  return worktrees
}

function within(root, path) {
  const rest = relative(root, path)
  return rest !== '..' && !rest.startsWith('..' + sep) && !isAbsolute(rest)
}

// Use the same execution world and standing sandbox as session tools.
async function git(ctx, policy, cwd, args, signal) {
  const program = await ctx.subprocess.resolveExecutable('git', undefined, signal)
  const command = [program, '--no-optional-locks', ...args]
  const argv = policy.mode === 'danger-full-access' ? command : (await ctx.sandbox.confine(command, policy, signal)).argv
  const child = ctx.subprocess.spawn({ argv, cwd, signal, graceMs: 500,
    env: { ...gitEnv, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' },
    stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 * 1024 }, stderr: { maxBytes: 8192 } },
  })
  try {
    const outcome = await child.done
    signal.throwIfAborted()
    if (outcome.exitCode !== 0) {
      const diagnostic = child.collected.stderr.readFrom(0).text
      if (outcome.exitCode === 128 && /not a git repository/i.test(diagnostic)) return null
      throw new GroupError('git-failed', `无法读取 Git 工作树。${diagnostic.trim()}`)
    }
    const { text, lossy } = child.collected.stdout.readFrom(0)
    if (lossy) throw new GroupError('git-output-limit', '工作树列表超过读取上限。')
    return text
  } finally {
    child.terminate()
    await child.waitForExit()
  }
}

async function physicalDirectory(ctx, path, signal) {
  const target = await ctx.fs.resolve(path, { signal })
  return (await ctx.fs.stat(target, signal))?.type === 'directory' ? ctx.fs.processPath(target) : null
}

// Git links a checkout's .git file to <common>/worktrees/<id>. That directory
// has both a commondir pointer and a gitdir backlink to the registered checkout.
// A submodule or a repository made with --separate-git-dir has a gitfile too.
async function registeredLinkedRoot(fs, root, signal) {
  const marker = join(root, '.git')
  async function pointer(path) {
    const target = await fs.resolve(path, { signal })
    const bytes = await fs.readBytes(target, signal, 64 * 1024)
    return Buffer.from(bytes).toString('utf8').replace(/\r?\n$/, '')
  }
  const forward = await pointer(marker)
  if (!forward.startsWith('gitdir: ') || forward.length <= 8) return null
  const admin = fs.processPath(await fs.resolve(resolve(root, forward.slice(8)), { signal }))
  if (basename(dirname(admin)) !== 'worktrees') return null
  const common = await pointer(join(admin, 'commondir'))
  const backlink = await pointer(join(admin, 'gitdir'))
  if (!common || !backlink) return null
  const shared = await fs.resolve(resolve(admin, common), { signal })
  const registered = await fs.resolve(resolve(admin, backlink), { signal })
  return relative(fs.processPath(shared), dirname(dirname(admin))) === ''
    && relative(fs.processPath(registered), marker) === '' ? root : null
}

export async function linkedWorktreeRoots(ctx, paths) {
  const signal = AbortSignal.timeout(10000)
  const ancestors = new Map()
  const roots = {}
  async function lookup(dir) {
    if (ancestors.has(dir)) return ancestors.get(dir)
    let root = null
    const parent = dirname(dir)
    if (basename(dir) !== '.git') {
      const marker = await ctx.fs.lstat(join(dir, '.git'), {}, signal)
      if (marker?.type === 'file') {
        try {
          root = await registeredLinkedRoot(ctx.fs, dir, signal)
        } catch {
          // An unreadable registration is a negative result for all its children.
          signal.throwIfAborted()
        }
      } else if (!marker && dir !== parent) root = await lookup(parent)
    }
    ancestors.set(dir, root)
    return root
  }
  for (const path of new Set(paths)) {
    if (!isAbsolute(path)) continue
    try {
      const dir = await physicalDirectory(ctx, path, signal)
      const root = dir && await lookup(dir)
      if (root) roots[path] = root
    } catch {
      // A missing or inaccessible session directory must not hide other rows.
      signal.throwIfAborted()
    }
  }
  return roots
}

async function writableRoots(ctx, policy, signal) {
  if (policy.mode !== 'workspace-write') return []
  const root = await physicalDirectory(ctx, policy.workspaceRoot, signal)
  const roots = root ? [root] : []
  if (process.platform !== 'win32') {
    for (const extra of policy.additionalWritableRoots ?? []) {
      const path = await physicalDirectory(ctx, extra, signal)
      if (path !== null && relative(path, extra) === '') roots.push(path)
    }
  }
  return roots
}

function blockedReason(policy, roots, path) {
  if (policy.mode === 'danger-full-access') return null
  if (policy.mode === 'workspace-write' && roots.some(root => within(root, path))) return null
  return policy.mode === 'read-only' ? '当前会话为只读模式。' : '此工作树位于会话可写目录之外。'
}

function activeWorkspace(ctx, sessionId) {
  const workspace = ctx.workspaceRegistry.list().find(item => item.sessionIds.includes(sessionId))
  if (!workspace || ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)) {
    throw new GroupError('workspace-missing', '该会话不在活动工作区中。')
  }
  return workspace
}

function placement(ctx, sessionId) {
  const agent = ctx.agents.get(sessionId)
  if (!agent || agent.session.header.origin === 'subagent') throw new GroupError('session-unavailable', '当前会话不可用。')
  return { agent, workspace: activeWorkspace(ctx, sessionId) }
}

function editable(ctx, session, recovering, maintenance = false) {
  const state = ctx.sessionProjections.snapshot(session, ['sessionListMetadata', 'inbox']).values
  // The public forgeWorktree wire view hides an open request. Its host state
  // exposes the request throughout creation, including before the first turn.
  const forge = ctx.sessionProjections.stateOf(session, 'forgeWorktree')
  // workingDirectory.set injects a context notice into the inbox. It isn't a
  // pending prompt and must allow another selection or reset in the same draft.
  const onlyDirectoryNotices = messages => Array.isArray(messages)
    && messages.every(message => message?.source?.kind === 'working-directory')
  // Once maintenance owns the Agent, new prompts wait for its release and
  // should run in the committed directory, including immediate keyboard sends.
  const idleInbox = onlyDirectoryNotices(state.inbox?.['next-turn']) && onlyDirectoryNotices(state.inbox?.['next-step'])
  return (state.sessionListMetadata?.blank === true || recovering) && (maintenance || idleInbox)
    && !forge?.request && (!forge?.locked || recovering) && !forge?.created && !forge?.restoring
}

async function options(ctx, workspace, session, signal, guard) {
  const defaultPath = await physicalDirectory(ctx, workspace.path, signal)
  if (!defaultPath) throw new GroupError('directory-missing', '工作区目录已不存在。')
  const policy = ctx.sandboxPolicy.resolve({ session })
  const text = await git(ctx, policy, defaultPath, ['worktree', 'list', '--porcelain', '-z'], signal)
  const roots = await writableRoots(ctx, policy, signal)
  const worktrees = []
  for (const row of parseWorktrees(text ?? '')) {
    const path = await physicalDirectory(ctx, row.path, signal)
    if (!path || relative(path, row.path) !== '') continue
    const reason = blockedReason(policy, roots, path)
    worktrees.push({ ...row, path, selectable: reason === null, blockedReason: reason })
  }
  const recovering = guard?.recovering(session) ?? false
  return { defaultPath, currentPath: ctx.workingDirectory.get(session), editable: editable(ctx, session, recovering), recovering, worktrees }
}

function requireEditable(ctx, agent, workspace, guard, maintenance = false) {
  const latest = placement(ctx, agent.session.id)
  if (latest.agent !== agent || latest.workspace.id !== workspace.id || latest.workspace.path !== workspace.path || !editable(ctx, agent.session, guard.recovering(agent.session), maintenance)) {
    throw new GroupError('session-busy', '会话已开始、正在发送消息或已请求新建工作树。')
  }
}

// Recheck immediately before the first prompt as well as at selection time.
export async function validateSelection(ctx, agent, path, control, state) {
  const signal = AbortSignal.any([control, AbortSignal.timeout(10000)])
  const { workspace } = placement(ctx, agent.session.id)
  const snapshot = state ?? await options(ctx, workspace, agent.session, signal)
  const row = snapshot.worktrees.find(item => item.path === path)
  if (!row) throw new GroupError('worktree-missing', '工作树已变化，请重新选择。')
  if (!row.selectable) throw new GroupError('worktree-denied', row.blockedReason)
  // A stale registration may point at an unrelated repository or an ordinary
  // directory now. Verify both checkout root and shared Git directory.
  const policy = ctx.sandboxPolicy.resolve({ session: agent.session })
  const root = await git(ctx, policy, path, ['rev-parse', '--show-toplevel'], signal)
  const common = ['rev-parse', '--path-format=absolute', '--git-common-dir']
  const sourceId = await git(ctx, policy, snapshot.defaultPath, common, signal)
  const targetId = await git(ctx, policy, path, common, signal)
  if (!root || relative(root.replace(/\r?\n$/, ''), path) !== '' || !sourceId || sourceId !== targetId) {
    throw new GroupError('worktree-missing', '目标已不属于此仓库，请重新选择。')
  }
  const latest = ctx.sandboxPolicy.resolve({ session: agent.session })
  const reason = blockedReason(latest, await writableRoots(ctx, latest, signal), path)
  if (reason) throw new GroupError('worktree-denied', reason)
}

export async function existingWorktrees(ctx, { sessionId, path, recoveryOnly = false }, guard) {
  if (recoveryOnly && !guard.hasIntent(sessionId)) return null
  if (!ctx.agents.get(sessionId)) {
    activeWorkspace(ctx, sessionId)
    const result = await ctx.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw result.error
  }
  const { agent, workspace } = placement(ctx, sessionId)
  if (recoveryOnly && !guard.recovering(agent.session)) return null
  const timeout = AbortSignal.timeout(10000)
  if (path === undefined) return options(ctx, workspace, agent.session, timeout, guard)
  requireEditable(ctx, agent, workspace, guard)
  let state
  const currentPath = await guard.apply(agent, path, async (control, beforeSet) => {
    const signal = AbortSignal.any([control, timeout])
    state = await options(ctx, workspace, agent.session, signal)
    if (path !== state.defaultPath) await validateSelection(ctx, agent, path, signal, state)
    requireEditable(ctx, agent, workspace, guard, true)
    await beforeSet(path === state.defaultPath ? null : path)
    requireEditable(ctx, agent, workspace, guard, true)
    return ctx.workingDirectory.set(agent, path, signal)
  })
  const recovering = guard.recovering(agent.session)
  return { ...state, currentPath, recovering, editable: editable(ctx, agent.session, recovering) }
}
