import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// SlotRegistry.inject runs its callback for each lifetime of the destination
// declaration. The sidebar entering and leaving toggles those declarations.
test('grouped row slots mirror native winners, reconcile replacements, and release registrations on exit', () => {
  const declarations = new Map()
  const winners = new Map()
  const listeners = new Map()
  const registrations = new Map()
  const slots = {
    inject(name, callback) { declarations.set(name, callback) },
    entriesOfSlot(name) { return winners.get(name) ?? [] },
    subscribe(name, callback) {
      listeners.set(name, callback)
      return () => listeners.delete(name)
    },
    register(options, component) {
      const key = `${options.name}/${options.id}`
      assert.ok(!registrations.has(key), `duplicate contribution ${key}`)
      registrations.set(key, { options, component })
      return () => registrations.delete(key)
    },
  }
  const ctx = { slots, get() {}, remoteAccess: { whenAccess() {} } }
  const window = { __ModuleLoader__: { load({ factory }) {
    factory(name => name === 'react' ? { createElement() {} } : {}).apply(ctx)
  } } }
  runInNewContext(client, { window, EventTarget })

  const trailing = 'sidebar.session.row.trailing'
  const hover = 'sidebar.session.row.hover'
  const trailingAlias = 'chat-groups.session.row.trailing'
  const hoverAlias = 'chat-groups.session.row.hover'
  const forge = { options: { id: 'forge-panel.row', order: 10 }, locale: 'forge',
    component() {}, inject: () => ({ hooks: { states: {} } }) }
  const hoverForge = { ...forge, options: { ...forge.options, order: 20 }, component() {} }
  const schedule = { options: { id: 'schedule-tasks', order: 30 }, locale: 'schedule',
    component() {}, inject: () => ({ hooks: { catalog: {} } }) }
  winners.set(trailing, [forge])
  winners.set(hover, [hoverForge, schedule])
  const closeTrailing = declarations.get(trailingAlias)()
  const closeHover = declarations.get(hoverAlias)()

  function assertMirrored(name, entry) {
    const mirror = registrations.get(`${name}/${entry.options.id}`)
    assert.equal(mirror.component, entry.component)
    assert.equal(mirror.options.name, name)
    assert.equal(mirror.options.id, entry.options.id)
    assert.equal(mirror.options.order, entry.options.order)
    assert.equal(mirror.options.locale, entry.locale)
    assert.equal(mirror.options.inject, entry.inject)
  }
  assertMirrored(trailingAlias, forge)
  assertMirrored(hoverAlias, hoverForge)
  assertMirrored(hoverAlias, schedule)

  const stable = registrations.get(`${hoverAlias}/schedule-tasks`)
  const replacement = { ...hoverForge, component() {}, inject: () => ({ hooks: { states: {} } }) }
  winners.set(hover, [replacement, schedule])
  listeners.get(hover)()
  assertMirrored(hoverAlias, replacement)
  assert.equal(registrations.get(`${hoverAlias}/schedule-tasks`), stable)
  winners.set(trailing, [])
  listeners.get(trailing)()
  assert.ok(!registrations.has(`${trailingAlias}/forge-panel.row`))

  closeHover()
  closeTrailing()
  assert.equal(registrations.size, 0)
  assert.equal(listeners.size, 0)
  const closeReopened = declarations.get(hoverAlias)()
  assertMirrored(hoverAlias, replacement)
  closeReopened()
  assert.equal(registrations.size, 0)
})
