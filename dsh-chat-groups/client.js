// DSH's browser loader supplies React from the application runtime.
window.__ModuleLoader__.load({
  id: 'dsh-chat-groups',
  factory(require) {
    const {
      createElement: h, Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore,
    } = require('react')
    const { createPortal } = require('react-dom')
    const {
      Button, Menu, MenuSurface, Modal, StateDot, Tooltip, useDismissOnOutsidePointer,
      IconEditOutlineRegular, IconEllipsisOutlineRegular, IconFlatListOutlineRegular, IconTrashOutlineRegular,
      IconFolderCloseRegular, IconFolderOpenRegular,
      IconNewChatOutlineRegular, IconProjectAddOutlineRegular, IconWorkspaceTreeOutlineRegular,
    } = require('@deepseek-ai/dsh-client-ui-primitives')
    const slot = 'sidebar.workspaces'
    const sessionActionSlot = 'sidebar.workspaces.session.row.action'
    const toolbarMount = 'shell.overlay'
    const workspaceHeader = '[data-sidebar-workspace-header]'
    const switchLabel = '切换到会话分组视图'
    const returnLabel = '返回默认视图'
    const toolbarStyle = `
      .dsh-chat-groups-toggle {
        display: inline-flex; flex: none; align-items: center; justify-content: center;
        width: 28px; height: 28px; border: 0; padding: 0; border-radius: var(--dsw-radius-sm, 6px);
        background: transparent; color: var(--dsw-alias-label-secondary, currentColor); cursor: pointer;
      }
      .dsh-chat-groups-toggle:hover { background: var(--dsw-alias-interactive-bg-hover, #8882); }
      .dsh-chat-groups-toggle:focus-visible {
        outline: 2px solid var(--dsw-focus-ring-color, #5d79cc); outline-offset: -2px;
      }
      .dsh-chat-groups-toggle:disabled { opacity: .55; cursor: default; }
      ${workspaceHeader}:not(:has(input)) > .dsh-chat-groups-toggle,
      ${workspaceHeader}:has(input[tabindex="0"]) > .dsh-chat-groups-toggle { display: none; }
    `
    const style = `
      .dsh-chat-groups { display: flex; flex-direction: column; max-height: 100cqh; min-height: 0; font-size: 13px; }
      .dsh-chat-groups-list { min-height: 0; overflow-y: auto; padding: 0 6px 8px; }
      .dsh-chat-groups-heading, .dsh-chat-groups-row { display: flex; gap: 3px; align-items: center; min-width: 0; }
      .dsh-chat-groups-heading { justify-content: space-between; padding: 4px 8px; }
      .dsh-chat-groups-branch { margin-left: 10px; padding-left: 5px; border-inline-start: 1px solid var(--dsw-alias-interactive-bg-hover, #8885); }
      .dsh-chat-groups-label, .dsh-chat-groups-icon {
        font: inherit; color: inherit; background: transparent; border: 0;
        border-radius: var(--dsw-radius-xs, 6px); cursor: pointer;
      }
      .dsh-chat-groups-label { padding: 5px 6px; text-align: start; }
      .dsh-chat-groups-label:hover, .dsh-chat-groups-icon:hover { background: var(--dsw-alias-interactive-bg-hover, #8882); }
      .dsh-chat-groups-label:focus-visible, .dsh-chat-groups-icon:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, #5d79cc); outline-offset: -2px; }
      .dsh-chat-groups-icon:disabled, .dsh-chat-groups-label:disabled { opacity: .55; cursor: default; }
      .dsh-chat-groups-row > .dsh-chat-groups-label { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; }
      .dsh-chat-groups-label > svg { flex: none; }
      .dsh-chat-groups-label > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dsh-chat-groups-status { flex: none; width: 16px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }
      .dsh-chat-groups-actions { flex: none; display: flex; align-items: center; gap: 5px; padding-inline-end: 3px; }
      .dsh-chat-groups-icon { flex: none; display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; color: var(--dsw-alias-label-tertiary); }
      .dsh-chat-groups-icon svg { width: 14px; height: 14px; }
      .dsh-chat-groups-native-actions { display: contents; }
      .dsh-chat-groups-row[aria-current=true] { border-radius: 6px; background: var(--dsw-alias-interactive-bg-hover, #8883); }
      .dsh-chat-groups-note { margin: 3px 8px; opacity: .8; overflow-wrap: anywhere; }
      @media (hover: hover) {
        .dsh-chat-groups-row > .dsh-chat-groups-actions { display: none; }
        .dsh-chat-groups-row:is(:hover, :has(button[aria-haspopup][aria-expanded=true])) > .dsh-chat-groups-actions,
        html[data-input-modality='keyboard'] .dsh-chat-groups-row:focus-within > .dsh-chat-groups-actions { display: flex; }
      }
      .dsh-chat-groups-field {
        box-sizing: border-box; width: 100%; height: 44px; padding: 7px 14px;
        border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-lg);
        background: transparent; color: var(--dsw-alias-label-primary); font: inherit;
        font-size: 14px; line-height: 22px;
      }
      .dsh-chat-groups-field:focus { outline: 1px solid var(--dsw-focus-ring-color, currentColor); }
      .dsh-chat-groups-popover {
        position: fixed; inset: calc(anchor(bottom) + 4px) 8px 8px max(8px, anchor(left));
        position-try-fallbacks: --dsh-chat-groups-above, --dsh-chat-groups-end, --dsh-chat-groups-above-end;
        align-self: start; justify-self: start; z-index: 1100;
        box-sizing: border-box; width: min(280px, calc(100vw - 16px)); max-height: calc(100dvh - 16px);
        overflow: auto; padding: 12px;
      }
      @position-try --dsh-chat-groups-above {
        top: 8px; bottom: calc(anchor(top) + 4px); align-self: end;
      }
      @position-try --dsh-chat-groups-end {
        left: 8px; right: max(8px, anchor(right)); justify-self: end;
      }
      @position-try --dsh-chat-groups-above-end {
        top: 8px; bottom: calc(anchor(top) + 4px); align-self: end;
        left: 8px; right: max(8px, anchor(right)); justify-self: end;
      }
      .dsh-chat-groups-popover form { display: grid; gap: 10px; font-size: 13px; overflow-wrap: anywhere; }
      .dsh-chat-groups-popover form p { margin: 0; }
      .dsh-chat-groups-popover .dsh-chat-groups-field { height: 32px; padding: 4px 8px; font-size: inherit; }
      .dsh-chat-groups-popover-footer { display: flex; justify-content: flex-end; gap: 6px; }
      .dsh-chat-groups-error { margin-top: 8px; font-size: 12px; color: var(--dsw-alias-state-error-primary); }
      .dsh-chat-groups-danger:not(:disabled) { color: var(--dsw-alias-state-error-primary); }
    `

    const pendingStatusLabel = new Map([
      ['approval', 'status.waitingApproval'],
      ['plan-review', 'status.planReview'],
      ['question', 'status.waitingAnswer'],
    ])

    function sessionRowStatus(session, catalog, statuses, t) {
      if (session.blank) return undefined
      const status = statuses.get(session.id)
      const pending = pendingStatusLabel.get(status?.pendingInteraction?.kind)
      if (pending !== undefined) return { state: 'warning', label: t(pending) }
      if (status?.running ?? session.running) return { state: 'ongoing', label: t('status.running') }

      const children = catalog.projectionsBySession[session.id]?.values.subagentCatalog ?? []
      const runningChildren = children.filter(({ id }) => statuses.get(id)?.running ?? catalog.byId[id]?.running).length
      if (runningChildren > 0) {
        const key = runningChildren === 1 ? 'status.subagentsRunning.one' : 'status.subagentsRunning.other'
        return { state: 'ongoing', label: t(key, { n: runningChildren }) }
      }
      if (status?.completionUnread) return { state: 'done', label: t('status.completed') }
      return undefined
    }

    function useSource(source) {
      return useSyncExternalStore(
        useCallback(listener => source.subscribe(listener), [source]),
        useCallback(() => source.getSnapshot(), [source]),
      )
    }
    const currentId = catalog => Object.values(catalog.byId)
      .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id
    const message = error => error instanceof Error ? error.message : String(error)
    const button = (label, onClick, attributes = {}) => h('button', {
      type: 'button', className: 'dsh-chat-groups-label', onClick, ...attributes,
    }, label)

    function iconButton(Icon, label, onClick, disabled, attributes = {}) {
      return h(Tooltip, { label, side: 'bottom', align: 'end', delayMs: 500, portal: true, disabled: attributes['aria-expanded'] },
        h('button', {
          type: 'button', className: 'dsh-chat-groups-icon', 'aria-label': label, onClick, disabled, ...attributes,
        }, h(Icon, { size: 14, 'aria-hidden': true })))
    }

    function ActionMenu({ Icon, label, disabled, items, onSelect, panel, triggerRef, anchorName }) {
      const [open, setOpen] = useState(false)
      return h(Menu, {
        open, items, portal: true, autoFocus: true, contextual: true,
        onClose: () => setOpen(false),
        onSelect(id) {
          setOpen(false)
          onSelect(id)
        },
        anchor: iconButton(Icon, label, event => {
          event.stopPropagation()
          event.currentTarget.focus({ preventScroll: true })
          if (panel) panel.close()
          else setOpen(!open)
        }, disabled && !panel, {
          ref: triggerRef,
          style: anchorName ? { anchorName } : undefined,
          'aria-haspopup': panel ? 'dialog' : 'menu',
          'aria-expanded': open || !!panel,
          'aria-controls': panel?.id,
        }),
      })
    }

    const groupActions = [
      { id: 'rename', label: '重命名分组', icon: h(IconEditOutlineRegular, { size: 14 }) },
      { id: 'delete', label: '删除分组', icon: h(IconTrashOutlineRegular, { size: 14 }), danger: true },
    ]

    function GroupActionPanel({ id, anchorName, trigger, action, groupName = '', description, pending, close, save, error, t }) {
      const [name, setName] = useState(groupName)
      const surface = useRef(null)
      const focusTarget = useRef(null)
      const editsName = action !== 'delete'
      const title = { create: '新增分组', rename: '重命名分组', delete: `删除「${groupName}」？` }[action]
      const blocked = pending || (editsName && (!name.trim() || name.trim() === groupName))
      useDismissOnOutsidePointer(trigger, true, () => close(false), surface)
      useLayoutEffect(() => {
        focusTarget.current.focus({ preventScroll: true })
        if (editsName) focusTarget.current.select()
      }, [editsName])
      return createPortal(h(MenuSurface, {
        ref: surface, id, role: 'dialog', 'aria-label': title,
        className: 'dsh-chat-groups-popover', style: { positionAnchor: anchorName },
        onKeyDown(event) {
          if (event.key === 'Escape' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        },
      }, h('form', {
        onSubmit(event) {
          event.preventDefault()
          if (!blocked) save(name.trim())
        },
      },
      h('strong', null, title),
      editsName ? h('input', {
        ref: focusTarget, className: 'dsh-chat-groups-field', 'aria-label': '分组名称',
        value: name, readOnly: pending, maxLength: 80, onChange: event => setName(event.target.value),
        onKeyDown(event) {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        },
      }) : h('p', null, description),
      error && h('div', { className: 'dsh-chat-groups-error', role: 'alert' }, error),
      h('div', { className: 'dsh-chat-groups-popover-footer' },
        h(Button, { ref: editsName ? undefined : focusTarget, type: 'button', size: 'sm', variant: 'outline',
          disabled: pending, onClick: () => close() }, t('cancel')),
        h(Button, { type: 'submit', size: 'sm', variant: editsName ? 'primary' : 'outline', disabled: blocked,
          className: editsName ? undefined : 'dsh-chat-groups-danger',
        }, editsName ? '保存' : '仅删除分组')),
      )), document.body)
    }

    function GroupActions({ groupName, description, createLabel, disabled, run, save, t }) {
      const [action, setAction] = useState(null)
      const [error, setError] = useState('')
      const trigger = useRef(null)
      const id = useId()
      const anchorName = `--dsh-chat-groups-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
      function dismiss(restoreFocus = true) {
        if (restoreFocus) trigger.current?.focus({ preventScroll: true })
        setAction(null)
      }
      const close = (restoreFocus) => { if (!disabled) dismiss(restoreFocus) }
      function open(next) {
        setError('')
        setAction(next)
      }
      return h(Fragment, null,
        createLabel ? iconButton(IconProjectAddOutlineRegular, createLabel,
          () => action ? close() : open('create'), disabled && !action, {
            ref: trigger, style: { anchorName }, 'aria-haspopup': 'dialog',
            'aria-expanded': !!action, 'aria-controls': action ? id : undefined,
          }) : h(ActionMenu, {
          Icon: IconEllipsisOutlineRegular, label: `${groupName}的操作`, disabled, items: groupActions,
          triggerRef: trigger, anchorName, panel: action && { id, close },
          onSelect: open,
        }),
        action && h(GroupActionPanel, {
          id, anchorName, trigger, action, groupName, description, pending: disabled, close, error, t,
          save: name => { void run(signal => save(action, name, signal), { close: dismiss, onError: setError }) },
        }),
      )
    }

    function RetryIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M13 6a5 5 0 1 0 .3 3M13 2.5V6H9.5' }))
    }

    function Dialog({ dialog, pending, error, close, submit, t }) {
      const [value, setValue] = useState(dialog.input?.value ?? '')
      const blocked = pending || (dialog.input && (!value.trim() || dialog.input.blocked?.(value.trim())))
      const field = {
        className: 'dsh-chat-groups-field', 'data-modal-autofocus': true, value, disabled: pending,
        onChange: event => setValue(event.target.value),
      }
      function confirm() {
        if (!blocked) submit(value)
      }
      return h(Modal, {
        open: true, onClose: () => { if (!pending) close() }, closeLabel: t('close'),
        title: dialog.title, description: dialog.description,
        footer: h(Fragment, null,
          h(Button, { variant: 'outline', disabled: pending, onClick: close }, t(dialog.submit ? 'cancel' : 'close')),
          dialog.submit && h(Button, {
            variant: dialog.danger ? 'outline' : 'primary',
            className: dialog.danger ? 'dsh-chat-groups-danger' : undefined,
            disabled: !!blocked, onClick: confirm,
          }, dialog.submit)),
      }, dialog.input && h('input', {
        ...field, 'aria-label': dialog.input.label ?? '分组名称', maxLength: dialog.input.maxLength,
        onFocus: event => event.currentTarget.select(),
        onKeyDown(event) {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault()
            confirm()
          }
        },
      }),
      error && h('div', { className: 'dsh-chat-groups-error', role: 'alert' }, error))
    }

    // rc.5 resolves these service methods at call time. Preserve the native
    // receiver and leave wrappers installed later by other plugins intact.
    function wrapMethod(target, name, decorate) {
      const previous = Object.getOwnPropertyDescriptor(target, name)
      const original = target[name]
      const decorated = decorate(original)
      let active = true
      function wrapped(...args) {
        return Reflect.apply(active ? decorated : original, this, args)
      }
      Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped })
      return () => {
        active = false
        if (Object.getOwnPropertyDescriptor(target, name)?.value !== wrapped) return
        if (previous) Object.defineProperty(target, name, previous)
        else delete target[name]
      }
    }

    function apply(ctx) {
      const sessions = ctx.get('sessions')
      const workspaces = ctx.get('workspaces')
      const connection = ctx.get('connection')
      const uiWorkspace = ctx.get('uiWorkspace')
      let stopView
      let originWorkspace
      let nativeWorkspace
      let nativeSessionActions
      const groupChanges = new EventTarget()
      let groupChannel

      function groupsChanged() {
        groupChanges.dispatchEvent(new Event('change'))
        groupChannel?.postMessage('change')
      }

      // Both workspace toolbars use the rc.5 workspace navigator. Restrict
      // only the candidate list; the navigator still owns presets and drafts.
      function ungroupedWorkspaceEntry(original) {
        return async function (workspace, ...args) {
          if (!workspace.sessionIds.length) return original.call(this, workspace, ...args)
          let sessionIds = []
          try {
            const state = await rpc('snapshot', {})
            const pending = new Set(Object.values(state.pendingSessions))
            sessionIds = workspace.sessionIds.filter(id => !Object.hasOwn(state.membership, id) && !pending.has(id))
          } catch {
            // If membership is unavailable, opening a fresh blank preserves group drafts.
          }
          return original.call(this, { ...workspace, sessionIds }, ...args)
        }
      }

      function observeFork(original) {
        return function fork(options) {
          return original.call(this, {
            ...options,
            onCreated(childSessionId) {
              void rpc('inheritForkGroup', { request: { sourceSessionId: options.sessionId, childSessionId } })
                .then(groupsChanged)
                .catch(error => ctx.contextMenus.notify(`分支已创建，自动归组失败：${message(error)}`))
              options.onCreated?.(childSessionId)
            },
          })
        }
      }

      async function rpc(method, args, signal) {
        const result = await connection.rpc.call('/api', `chatGroups/${method}`, { args }, signal)
        if (!result.ok) throw new Error(result.error.message)
        return result.value
      }

      function exit() {
        stopView?.()
        stopView = undefined
      }

      function WorkspaceToolbarButton() {
        const { items } = useSource(workspaces.list)
        const [container, setContainer] = useState(null)
        useEffect(() => {
          // rc.5 exposes this toolbar marker but has no slot for trailing actions.
          // The native toolbar remounts when the grouped view releases the sidebar slot.
          let header = null
          function findHeader() {
            if (header?.isConnected) return
            const next = document.querySelector(workspaceHeader)
            if (next === header) return
            header = next
            setContainer(header)
          }
          const observer = new MutationObserver(findHeader)
          observer.observe(document.body, { childList: true, subtree: true })
          findHeader()
          return () => observer.disconnect()
        }, [])
        if (container === null) return null
        return createPortal([
          h('style', { key: 'style' }, toolbarStyle),
          h('button', {
            key: 'toggle', type: 'button', className: 'dsh-chat-groups-toggle',
            title: switchLabel, 'aria-label': switchLabel, disabled: items.length === 0,
            onClick() {
              try {
                enter()
              } catch (error) {
                ctx.contextMenus.notify('无法切换到会话分组视图。')
                console.warn('dsh-chat-groups: unable to replace the workspace sidebar', error)
              }
            },
          }, h('svg', {
            width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
            stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round',
            'aria-hidden': true,
          }, h('path', { d: 'M8 2.5 14 5.5 8 8.5 2 5.5Z M2 8l6 3 6-3 M2 10.5l6 3 6-3' }))),
        ], container)
      }

      function NativeWorkspaceActions({ target, renderFactorySlot, useWorkspaceAccess, t }) {
        const { workspaceId, displayTitle } = target.value
        const canCreate = useWorkspaceAccess(workspaceId, 'session/create')
        return h('span', { className: 'dsh-chat-groups-native-actions' },
          renderFactorySlot('contextMenu.button', {
            target, label: t('actions.workspace.aria', { name: displayTitle }), className: 'dsh-chat-groups-icon',
          }),
          canCreate && iconButton(IconNewChatOutlineRegular,
            t('actions.newSession.aria', { name: displayTitle }), () => nativeWorkspace.startSession(workspaceId)),
        )
      }

      function GroupedSidebar({
        wide, expandSidebar, useSectionScroller, useContextMenu, useSessionAccess, useWorkspaceAccess,
        renderFactorySlot, useSessionStatus, t,
      }) {
        const workspaceList = useSource(workspaces.list)
        const catalog = useSource(sessions.list)
        const statuses = useSessionStatus(snapshot => snapshot)
        const generation = useSource(connection.generation)
        const workspaceAction = useSource(nativeWorkspace.hooks.workspaceActionRequest)
        const { bindScrollerRef } = useSectionScroller()
        const { getTriggerProps } = useContextMenu()
        const [data, setData] = useState(null)
        const [collapsedWorkspaces, setCollapsedWorkspaces] = useState(() => new Set(
          workspaces.list.getSnapshot().items
            .filter(workspace => workspace.workspaceId !== originWorkspace)
            .map(workspace => workspace.workspaceId),
        ))
        const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())
        const [dialogError, setDialogError] = useState('')
        const [status, setStatus] = useState('')
        const [pending, setPending] = useState(false)
        const operation = useRef(false)
        const revision = useRef(0)
        const refreshPending = useRef(false)
        const lifetime = useRef(null)
        useEffect(() => {
          const controller = new AbortController()
          lifetime.current = controller
          return () => controller.abort()
        }, [])
        useEffect(() => {
          if (generation === undefined) return
          const controller = new AbortController()
          async function refresh() {
            if (operation.current) {
              refreshPending.current = true
              return
            }
            refreshPending.current = false
            const version = ++revision.current
            try {
              const snapshot = await rpc('snapshot', {}, controller.signal)
              if (!controller.signal.aborted && version === revision.current) {
                setData(snapshot)
                setStatus('')
              }
            } catch (error) {
              if (!controller.signal.aborted && version === revision.current) setStatus(message(error))
            }
          }
          void refresh()
          window.addEventListener('focus', refresh)
          groupChanges.addEventListener('change', refresh)
          return () => {
            groupChanges.removeEventListener('change', refresh)
            controller.abort()
            window.removeEventListener('focus', refresh)
          }
        }, [generation])

        const active = currentId(catalog)
        const listed = new Set(catalog.ids)
        const archived = new Set(workspaceList.archivedSessionIds)
        const groupBySession = data?.membership ?? {}
        const shown = new Set()
        const allGroups = Object.entries(data?.groups ?? {})
        const groupsByWorkspace = new Map()
        for (const entry of allGroups) {
          const workspaceId = entry[1].workspaceId
          if (!groupsByWorkspace.has(workspaceId)) groupsByWorkspace.set(workspaceId, [])
          groupsByWorkspace.get(workspaceId).push(entry)
        }
        const workspaceLabel = title => title === 'default-workspace' ? t('workspace.defaultName') : title
        const sessionLabel = session => session.blank ? t('session.new') : (session.title?.trim() || t('session.untitled'))
        const dialog = workspaceAction === null ? null : workspaceActionDialog()
        function closeDialog() {
          nativeWorkspace.settleWorkspaceAction()
          setDialogError('')
        }

        function workspaceActionDialog() {
          const { action, workspaceId, displayTitle, storedTitle } = workspaceAction
          const key = `workspace:${action}:${workspaceId}`
          if (action === 'rename') return {
            key, title: t('rename.workspace.title'), submit: t('rename'),
            input: {
              value: displayTitle, label: t('field.workspaceName'),
              blocked: value => value === storedTitle || workspaceList.items.some(
                item => item.workspaceId !== workspaceId && workspaceLabel(item.title) === value,
              ),
            },
            save: value => nativeWorkspace.renameWorkspace(workspaceId, value.trim()),
          }
          return {
            key, title: t('delete.workspace'), submit: t('delete.workspace'), danger: true,
            description: t('delete.desc', { name: displayTitle }),
            save: () => nativeWorkspace.deleteWorkspace(workspaceId),
          }
        }

        function viewFold(setter, id, forceOpen = false) {
          setter(previous => {
            const next = new Set(previous)
            if (forceOpen || next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }

        async function run(action, { close, onError = setStatus } = {}) {
          if (operation.current) return
          const { signal } = lifetime.current
          operation.current = true
          revision.current += 1
          setPending(true)
          setStatus('')
          onError('')
          try {
            await action(signal)
            if (!signal.aborted) close?.()
          } catch (error) {
            if (!signal.aborted) onError(message(error))
          } finally {
            operation.current = false
            if (!signal.aborted) {
              setPending(false)
              if (refreshPending.current) groupChanges.dispatchEvent(new Event('change'))
            }
          }
        }

        async function change(request, signal) {
          const result = await rpc('change', { request }, signal)
          if (!signal.aborted) setData(result)
        }

        function assign(workspaceId, sessionId, groupId, signal) {
          return change({ action: 'assign', workspaceId, sessionId, groupId }, signal)
        }

        async function createGroup(workspaceId, name, signal) {
          await change({ action: 'create', workspaceId, name }, signal)
          if (!signal.aborted) viewFold(setCollapsedWorkspaces, workspaceId, true)
        }

        async function saveGroup(workspaceId, groupId, action, name, signal) {
          if (action === 'rename') {
            await change({ action, workspaceId, groupId, name }, signal)
          } else {
            await change({ action, workspaceId, groupId }, signal)
            if (!signal.aborted) viewFold(setCollapsedGroups, groupId, true)
          }
        }

        function createInGroup(workspaceId, groupId, retrySessionId) {
          void run(async signal => {
            const before = currentId(sessions.list.getSnapshot())
            let result
            try {
              result = await rpc('createSession', { request: { workspaceId, groupId, retrySessionId } }, signal)
            } catch (error) {
              const snapshot = await rpc('snapshot', {}, signal).catch(() => undefined)
              if (!signal.aborted && snapshot !== undefined) {
                setData(snapshot)
                if (snapshot.pendingSessions[groupId] !== undefined) {
                  throw new Error(`会话还未加入分组，可用「重试保存」继续。 ${message(error)}`)
                }
              }
              throw error
            }
            if (signal.aborted) return
            setData(result.state)
            viewFold(setCollapsedGroups, groupId, true)
            if (currentId(sessions.list.getSnapshot()) === before) uiWorkspace.openSession(result.sessionId)
          })
        }

        function openSession(id) {
          const latest = sessions.list.getSnapshot()
          const currentWorkspaces = workspaces.list.getSnapshot()
          if (!latest.ids.includes(id) || currentWorkspaces.archivedSessionIds.includes(id)
              || !currentWorkspaces.items.some(workspace => workspace.sessionIds.includes(id))) {
            setStatus('会话当前不可打开。')
            return
          }
          // DSH clears completionUnread when the session enters the main view.
          uiWorkspace.openSession(id)
        }

        function sessionRow(workspaceId, session, groupId, groups) {
          const displayTitle = sessionLabel(session)
          const status = sessionRowStatus(session, catalog, statuses, t)
          const titleWithStatus = status ? `${displayTitle} · ${status.label}` : displayTitle
          const target = session.blank ? undefined : {
            kind: 'session', value: { sessionId: session.id, displayTitle: session.title?.trim() ?? '' },
          }
          const destinations = groups.filter(([id]) => id !== groupId).map(([id, group]) => ({ id, label: group.name }))
          if (groupId !== undefined) {
            if (destinations.length) destinations.push({ type: 'separator', id: 'ungroup-separator' })
            destinations.push({ id: '', label: '移出分组，返回工作区' })
          }
          return h('div', {
            key: session.id, className: 'dsh-chat-groups-row', 'data-session-id': session.id,
            'aria-current': session.id === active ? 'true' : undefined, ...getTriggerProps(target),
          },
          button(h(Fragment, null,
            h('span', { className: 'dsh-chat-groups-status' }, status && h(StateDot, { state: status.state })),
            h('span', null, displayTitle),
          ), () => openSession(session.id), { title: titleWithStatus, 'aria-label': titleWithStatus }),
          h('span', { className: 'dsh-chat-groups-actions' },
            target && h('span', { className: 'dsh-chat-groups-native-actions' },
              renderFactorySlot('contextMenu.button', {
                target, label: t('actions.session.aria', { name: displayTitle }), className: 'dsh-chat-groups-icon',
              }),
              nativeSessionActions.map(({ key, Component, callbacks, hooks }) => h(Component, {
                key, ...callbacks, t, useSessionAccess, sessionId: session.id, displayTitle: target.value.displayTitle,
                useArchived: selector => selector(useSource(hooks.archived)),
                usePinned: hooks.pinned && (selector => selector(useSource(hooks.pinned))),
              })),
            ),
            h(ActionMenu, {
              Icon: IconWorkspaceTreeOutlineRegular, label: `调整「${displayTitle}」的分组`,
              disabled: pending || data === null,
              items: destinations.length ? destinations : [{ id: 'empty', label: '当前工作区暂无可选分组', disabled: true }],
              onSelect: id => { void run(async signal => {
                await assign(workspaceId, session.id, id || null, signal)
                if (id && !signal.aborted) viewFold(setCollapsedGroups, id, true)
              }) },
            }),
          ))
        }

        function workspaceRows(workspace) {
          const id = workspace.workspaceId
          const groups = groupsByWorkspace.get(id) ?? []
          const workspaceGroupIds = new Set(groups.map(([groupId]) => groupId))
          const members = new Map()
          for (const sessionId of workspace.sessionIds) {
            if (shown.has(sessionId) || archived.has(sessionId) || !listed.has(sessionId)) continue
            const session = catalog.byId[sessionId]
            if (!session || session.origin === 'subagent') continue
            // Match the native list: only the current blank is a visible
            // placeholder. Ordinary forks can carry parentId and still belong here.
            if (session.blank && sessionId !== active) continue
            shown.add(sessionId)
            const assigned = groupBySession[sessionId]
            const groupId = workspaceGroupIds.has(assigned) ? assigned : undefined
            if (!members.has(groupId)) members.set(groupId, [])
            members.get(groupId).push(session)
          }
          const rowsByRecency = [
            ...(members.get(undefined) ?? []).map(session => ({ session, updatedAt: session.updatedAt })),
            ...groups.map(([groupId, group]) => {
              const rows = members.get(groupId) ?? []
              const updatedAt = rows.length
                ? rows.reduce((latest, session) => Math.max(latest, session.updatedAt), 0)
                : group.createdAt ?? 0
              return { groupId, group, rows, updatedAt }
            }),
          ].sort((left, right) => right.updatedAt - left.updatedAt)
          const expanded = !collapsedWorkspaces.has(id)
          const title = workspaceLabel(workspace.title)
          const target = { kind: 'workspace', value: { workspaceId: id, path: workspace.path, displayTitle: title } }
          return h('section', { key: id },
            h('div', { className: 'dsh-chat-groups-row', ...getTriggerProps(target) },
              button(h(Fragment, null,
                h(expanded ? IconFolderOpenRegular : IconFolderCloseRegular, { size: 14, 'aria-hidden': true }),
                h('span', null, title)),
              () => viewFold(setCollapsedWorkspaces, id), { 'aria-expanded': expanded, title }),
              h('span', { className: 'dsh-chat-groups-actions' },
                h(NativeWorkspaceActions, { target, renderFactorySlot, useWorkspaceAccess, t }),
                h(GroupActions, {
                  createLabel: `在「${title}」中新增分组`, disabled: pending || data === null, run, t,
                  save: (_action, name, signal) => createGroup(id, name, signal),
                }),
              ),
            ),
            expanded && h('div', { className: 'dsh-chat-groups-branch' },
              rowsByRecency.map(({ session, groupId, group, rows }) => {
                if (session) return sessionRow(id, session, undefined, groups)
                const open = !collapsedGroups.has(groupId)
                const retrySessionId = data.pendingSessions[groupId]
                return h('section', { key: groupId },
                  h('div', { className: 'dsh-chat-groups-row' },
                    button(h('span', null, `${open ? '▾' : '▸'} ${group.name}`), () => viewFold(setCollapsedGroups, groupId),
                      { 'aria-expanded': open, title: group.name }),
                    h('span', { className: 'dsh-chat-groups-actions' },
                      iconButton(retrySessionId ? RetryIcon : IconNewChatOutlineRegular,
                        retrySessionId ? `重试保存到${group.name}` : `在${group.name}新建会话`,
                        () => createInGroup(id, groupId, retrySessionId), pending),
                      h(GroupActions, {
                        groupName: group.name,
                        description: `组内可见的 ${rows.length} 条会话将移回「${title}」。删除分组会保留全部会话。`,
                        disabled: pending, run, t,
                        save: (action, name, signal) => saveGroup(id, groupId, action, name, signal),
                      }),
                    ),
                  ),
                  open && h('div', { className: 'dsh-chat-groups-branch' }, rows.length
                    ? rows.map(session => sessionRow(id, session, groupId, groups))
                    : h('p', { className: 'dsh-chat-groups-note' }, '暂无会话')),
                )
              }),
            ),
          )
        }

        return h('div', { className: 'dsh-chat-groups' },
          h('style', null, style),
          wide ? h('div', { className: 'dsh-chat-groups-heading' },
            h('strong', null, '会话分组'), iconButton(IconFlatListOutlineRegular, returnLabel, exit, pending),
          ) : iconButton(IconWorkspaceTreeOutlineRegular, '展开会话分组', expandSidebar),
          wide && h('nav', { ref: bindScrollerRef, className: 'dsh-chat-groups-list', 'aria-label': '工作区与会话分组' },
            status && h('p', { className: 'dsh-chat-groups-note', role: 'status' }, status),
            data === null && !status && h('p', { className: 'dsh-chat-groups-note', role: 'status' }, '正在加载会话分组…'),
            workspaceList.items.map(workspaceRows),
          ),
          dialog && h(Dialog, { key: dialog.key, dialog, pending, error: dialogError, t,
            close: closeDialog,
            submit: value => { void run(signal => dialog.save(value, signal), { close: closeDialog, onError: setDialogError }) },
          }),
        )
      }

      function enter() {
        if (stopView) return
        const { items } = workspaces.list.getSnapshot()
        const active = currentId(sessions.list.getSnapshot())
        const workspace = items.find(item => item.sessionIds.includes(active)) ?? items[0]
        if (workspace === undefined) return
        // The original row actions and workspace dialog requests stay live
        // while the grouped browser shadows the native sidebar registration.
        nativeWorkspace = ctx.slots.entriesOfSlot(slot)[0]?.inject?.()
        if (!nativeWorkspace?.hooks?.workspaceActionRequest) throw new Error('未找到 DSH 原生工作区操作。')
        nativeSessionActions = ctx.slots.entriesOfSlot(sessionActionSlot)
          .filter(entry => ['archive', 'pin'].includes(entry.options.id))
          .sort((left, right) => left.options.order - right.options.order)
          .map(({ component: Component, options, inject }) => {
            const { hooks, ...callbacks } = inject()
            return { Component, key: options.id, hooks, callbacks }
          })
        originWorkspace = workspace.workspaceId
        const withdraw = ctx.slots.inject(slot,
          () => ctx.slots.register({ name: slot, locale: 'workspace', priority: -10 }, GroupedSidebar))
        if (ctx.slots.entriesOfSlot(slot)[0]?.component === GroupedSidebar) {
          stopView = withdraw
        } else {
          withdraw()
          throw new Error('会话分组视图无法接管侧栏。')
        }
      }

      ctx.remoteAccess.whenAccess('chatGroups/snapshot', () => {
        const restoreFork = wrapMethod(sessions, 'fork', observeFork)
        const restoreWorkspaceEntry = wrapMethod(uiWorkspace, 'createInWorkspace', ungroupedWorkspaceEntry)
        if (typeof BroadcastChannel === 'function') {
          groupChannel = new BroadcastChannel('dsh-chat-groups')
          groupChannel.onmessage = () => groupChanges.dispatchEvent(new Event('change'))
        }
        const unregister = ctx.slots.inject(toolbarMount, () => ctx.slots.register({
          name: toolbarMount, id: 'chat-groups-workspace-toolbar',
        }, WorkspaceToolbarButton))
        return () => {
          restoreWorkspaceEntry()
          restoreFork()
          groupChannel?.close()
          groupChannel = undefined
          exit()
          unregister()
        }
      })
    }

    return {
      name: 'dsh-chat-groups',
      inject: ['contextMenus', 'slots', 'sessions', 'workspaces', 'connection', 'uiWorkspace', 'remoteAccess'],
      apply,
    }
  },
})
