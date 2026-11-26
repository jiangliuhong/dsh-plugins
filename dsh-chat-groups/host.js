import { Service } from '@deepseek-ai/cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { RemoteError, bindTypertRemote, remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { createGroupOperations, emptyGroups, GroupError } from './groups.js'

const id = z.string().min(1).max(256)
const nameSchema = z.string().trim().min(1).max(80)
const stateSchema = z.object({
  groups: z.record(z.uuid(), z.object({
    workspaceId: id,
    name: nameSchema,
    createdAt: z.number().int().nonnegative().optional(),
  })),
  membership: z.record(id, z.uuid()),
  pendingSessions: z.record(z.uuid(), id).default({}),
})
const requestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('create'), workspaceId: id, name: nameSchema }),
  z.strictObject({ action: z.literal('rename'), workspaceId: id, groupId: z.uuid(), name: nameSchema }),
  z.strictObject({ action: z.literal('delete'), workspaceId: id, groupId: z.uuid() }),
  z.strictObject({ action: z.literal('assign'), workspaceId: id, sessionId: id, groupId: z.uuid().nullable() }),
])
const createSessionSchema = z.strictObject({
  workspaceId: id,
  groupId: z.uuid(),
  retrySessionId: id.optional(),
})
const createdSessionSchema = z.object({ state: stateSchema, sessionId: id })
const domainSpec = defineDomain({
  name: 'chat_groups',
  version: 1,
  tables: { state: domainTable(stateSchema) },
})

const packageName = 'dsh-chat-groups'
const serviceKey = 'chatGroups'
const codec = (type, schema) => ({
  mode: 'strict',
  typeSymbol: `${packageName}#${type}`,
  create: () => schema,
})
const invocations = [
  { method: 'snapshot', result: codec('Groups', stateSchema) },
  { method: 'change', request: codec('GroupRequest', requestSchema), result: codec('Groups', stateSchema) },
  {
    method: 'inheritForkGroup',
    request: codec('InheritForkGroupRequest', z.strictObject({ sourceSessionId: id, childSessionId: id })),
    result: codec('Groups', stateSchema),
  },
  {
    method: 'createSession',
    request: codec('CreateSessionRequest', createSessionSchema),
    result: codec('CreatedSession', createdSessionSchema),
  },
].map(({ method, request, result }) => ({
  id: `${packageName}:${method}`,
  service: serviceKey,
  namespace: serviceKey,
  method,
  invocation: { kind: 'direct' },
  parameters: request === undefined ? [] : [{
    name: 'request',
    wire: 'request',
    source: 'json',
    codec: request,
  }],
  result,
}))

export const name = packageName
export const inject = [
  'typert', 'remoteAccess', 'storageDomain', 'workspaceRegistry', 'sessionPersistence', 'sessions', 'sessionController',
]

class ChatGroups extends Service {
  constructor(ctx, table) {
    super(ctx, serviceKey)
    this.typertRemote = bindTypertRemote(this, serviceKey)
    this.operations = createGroupOperations({
      read: () => table.get('groups') ?? emptyGroups(),
      write: state => table.put('groups', state),
      workspace: workspaceId => ctx.workspaceRegistry.get(workspaceId),
      available: async sessionId => ctx.sessions.get(sessionId) !== undefined
        || (await ctx.sessionPersistence.stat(sessionId)) !== undefined,
      archived: sessionId => ctx.workspaceRegistry.archivedSessionIds.includes(sessionId),
      async createNativeSession(request) {
        try {
          return await ctx.sessionController.create(request)
        } catch (error) {
          const failure = remoteErrorOf(error)
          if (failure?.code !== 'session/workspace-attach-failed'
              || failure.details.workspaceId !== request.workspaceId) throw error
          return { sessionId: failure.details.sessionId, attachmentError: error }
        }
      },
    })
  }

  requireOwner() {
    if (this.ctx.invocation?.peer.principal.kind !== 'owner') {
      throw new RemoteError('chat-groups/access-denied', '当前用户无权管理会话分组。', {})
    }
  }

  snapshot() {
    this.requireOwner()
    return this.operations.snapshot()
  }

  async change(request) {
    return this.run(() => this.operations.change(request))
  }

  async inheritForkGroup(request) {
    return this.run(() => this.operations.inheritForkGroup(request))
  }

  async createSession(request) {
    return this.run(() => this.operations.createSession(request))
  }

  async run(operation) {
    this.requireOwner()
    try {
      return await operation()
    } catch (error) {
      if (!(error instanceof GroupError)) throw error
      throw new RemoteError(error.code, error.message, {})
    }
  }
}

export function apply(ctx) {
  ctx.effect(async () => {
    const domain = await ctx.storageDomain.open(domainSpec)
    try {
      new ChatGroups(ctx, domain.table('state'))
      const unregister = ctx.typert.register({
        package: packageName,
        face: 'host',
        schemas: [],
        model: { services: [], events: [], objects: [] },
        invocations,
      })
      return async () => {
        await unregister()
        await domain.close()
      }
    } catch (error) {
      await domain.close()
      throw error
    }
  }, 'chat-groups storage')
}
