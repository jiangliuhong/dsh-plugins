import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// Exercise the shipped factory's private row components without exporting test APIs.
function fixture() {
  const scope = {}
  const slotCalls = []
  const times = []
  let groupMenuOpen = false
  const react = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children: children.flat() } },
    Fragment: Symbol('Fragment'),
    useState: () => [groupMenuOpen, open => { groupMenuOpen = open }],
  }
  const primitives = {
    StateDot: Symbol('StateDot'), HoverCard: Symbol('HoverCard'),
    relativeTime(updatedAt, now) {
      times.push([updatedAt, now])
      return updatedAt === now ? { unit: 'now' } : { unit: 'min', n: 5 }
    },
  }
  const window = { __ModuleLoader__: { load({ factory }) {
    factory(name => name === 'react' ? react : primitives)
  } } }
  const start = '    function apply(ctx) {'
  assert.ok(client.includes(start))
  runInNewContext(client.replace(start, `    Object.assign(scope, { SessionHoverContent, sessionStatuses, SessionCard })\n${start}`), { window, scope })
  const t = (key, args) => args?.t ? `${key}(${args.t})` : args?.n ? `${key}:${args.n}` : key
  const props = {
    session: { id: 's', title: 'Title', cwd: '/Users/me/project', updatedAt: 10, blank: false },
    displayTitle: 'Title', home: '/Users/me/', now: 20, states: [{ state: 'idle', label: 'status.idle' }], t,
    renderSlot(name, { sessionId }) { slotCalls.push([name, sessionId]); return { type: name, children: [] } },
  }
  return { ...scope, props, slotCalls, times, primitives }
}

test('native hover delay and copy, trailing slot and menu suppression coexist with opening the row', () => {
  const { SessionCard, props, primitives, slotCalls } = fixture()
  let opens = 0
  const row = { ...props, onOpen: () => opens++, rowProps: { 'data-session-id': 's' }, menuOpen: false }
  const card = SessionCard(row)
  assert.equal(card.type, primitives.HoverCard)
  assert.equal(card.props.copyText, 'Title')
  assert.equal(card.props.copyLabel, 'copy')
  assert.equal(card.props.copiedLabel, 'hover.copied')
  assert.equal(card.props.openDelayMs, 800)
  assert.equal(card.props.grouped, true)
  assert.equal(card.props.disabled, false)
  const anchor = card.props.anchor
  assert.equal(anchor.props['data-session-id'], 's')
  assert.equal(anchor.children[0].props.title, undefined)
  const openButton = anchor.children[0]
  const trailing = openButton.children[0].children.at(-1)
  assert.equal(trailing.children[0].type, 'chat-groups.session.row.trailing')
  openButton.props.onClick()
  assert.equal(opens, 1)
  assert.deepEqual(slotCalls, [['chat-groups.session.row.trailing', 's']])
  const menu = anchor.children.at(-1).children.at(-1)
  menu.props.onOpenChange(true)
  assert.equal(SessionCard(row).props.disabled, true)
  menu.props.onOpenChange(false)
  assert.equal(SessionCard(row).props.disabled, false)
  assert.equal(SessionCard({ ...row, menuOpen: true }).props.disabled, true)
  slotCalls.length = 0
  assert.equal(SessionCard({ ...row, session: { id: 's', blank: true } }).props.copyText, undefined)
  assert.equal(slotCalls.length, 0)
})

function text(node) {
  if (typeof node === 'string') return node
  return node?.children?.map(text).join('') ?? ''
}

test('session hover matches native title, POSIX path, relative time, extension and concurrent statuses in order', () => {
  const { SessionHoverContent, sessionStatuses, props, slotCalls, times } = fixture()
  const statuses = new Map([['s', { pendingInteraction: { kind: 'approval' }, running: true, completionUnread: true }]])
  const catalog = { byId: { child: { running: true } }, projectionsBySession: { s: { values: { subagentCatalog: [{ id: 'child' }] } } } }
  const states = sessionStatuses(props.session, catalog, statuses, props.t)
  const content = SessionHoverContent({ ...props, states })
  assert.deepEqual(content.children.map(text), ['Title', '~/project', 'time.ago(time.min:5)', '', 'status.waitingApproval', 'status.subagentsRunning.one:1'])
  assert.equal(content.children[3].type, 'chat-groups.session.row.hover')
  assert.deepEqual(slotCalls, [['chat-groups.session.row.hover', 's']])
  assert.deepEqual(times, [[10, 20]])
})

test('blank omits missing path and time; Windows path and bare now follow native rules', () => {
  const { SessionHoverContent, props, times } = fixture()
  const blank = SessionHoverContent({ ...props, session: { id: 'new', blank: true }, displayTitle: 'session.new' })
  assert.deepEqual(blank.children.filter(Boolean).map(text), ['session.new', '', 'status.idle'])
  assert.equal(times.length, 0)
  const windows = SessionHoverContent({ ...props, now: 10, home: 'C:\\Users\\me', session: { ...props.session, cwd: 'C:\\Users\\me\\p' } })
  assert.deepEqual(windows.children.slice(1, 3).map(text), ['C:\\Users\\me\\p', 'time.now'])
})
