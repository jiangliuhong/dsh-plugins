// DSH's browser loader supplies React from the application runtime.
window.__ModuleLoader__.load({
  id: 'dsh-chat-groups',
  factory(require) {
    const { createElement: h, Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } = require('react')
    const { createPortal } = require('react-dom')
    const {
      Button, Modal, Tooltip, IconEllipsisOutlineRegular, IconFlatListOutlineRegular,
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
      .dsh-chat-groups-status-dot { box-sizing: border-box; flex: none; width: 8px; height: 8px; border-radius: 50%; }
      .dsh-chat-groups-status-dot[data-state=warning] {
        border-radius: 2px; background: var(--dsw-alias-state-warn-primary); transform: rotate(45deg) scale(.8);
      }
      .dsh-chat-groups-status-dot[data-state=ongoing] { border: 2px solid var(--dsw-alias-state-business-primary); }
      .dsh-chat-groups-status-dot[data-state=done] { background: var(--dsw-alias-state-done-primary); }
      .dsh-chat-groups-actions { flex: none; display: flex; align-items: center; gap: 5px; padding-inline-end: 3px; }
      .dsh-chat-groups-icon { flex: none; display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; color: var(--dsw-alias-label-tertiary); }
      .dsh-chat-groups-icon svg { width: 14px; height: 14px; }
      .dsh-chat-groups-native-actions { display: contents; }
      .dsh-chat-groups-row[aria-current=true] { border-radius: 6px; background: var(--dsw-alias-interactive-bg-hover, #8883); }
      .dsh-chat-groups-note { margin: 3px 8px; opacity: .8; overflow-wrap: anywhere; }
      @media (hover: hover) {
        .dsh-chat-groups-row > .dsh-chat-groups-actions { display: none; }
        .dsh-chat-groups-row:is(:hover, :has(button[aria-haspopup=menu][aria-expanded=true])) > .dsh-chat-groups-actions,
        html[data-input-modality='keyboard'] .dsh-chat-groups-row:focus-within > .dsh-chat-groups-actions { display: flex; }
      }
      .dsh-chat-groups-field {
        box-sizing: border-box; width: 100%; height: 44px; padding: 7px 14px;
        border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-lg);
        background: transparent; color: var(--dsw-alias-label-primary); font: inherit;
        font-size: 14px; line-height: 22px;
      }
      .dsh-chat-groups-field:focus { outline: 1px solid var(--dsw-focus-ring-color, currentColor); }
      .dsh-chat-groups-menu { display: grid; gap: 8px; }
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

    function iconButton(Icon, label, onClick, disabled) {
      return h(Tooltip, { label, side: 'bottom', align: 'end', delayMs: 500, portal: true },
        h('button', {
          type: 'button', className: 'dsh-chat-groups-icon', 'aria-label': label, onClick, disabled,
        }, h(Icon, { size: 14, 'aria-hidden': true })))
    }

    function RetryIcon() {
      return h('svg', {
        viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M13 6a5 5 0 1 0 .3 3M13 2.5V6H9.5' }))
    }

    function Dialog({ dialog, pending, error, close, submit, t }) {
      const [value, setValue] = useState(dialog.input?.value ?? dialog.choices?.[0]?.[0] ?? '')
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
      dialog.choices && h('select', { ...field, 'aria-label': '选择分组' },
        dialog.choices.map(([id, name]) => h('option', { key: id, value: id }, name))),
      dialog.actions && h('div', { className: 'dsh-chat-groups-menu' },
        dialog.actions.map(([label, run]) => h(Button, { key: label, variant: 'outline', onClick: run }, label))),
      error && h('div', { className: 'dsh-chat-groups-error', role: 'alert' }, error))
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
        const [groupDialog, setDialog] = useState(null)
        const [dialogError, setDialogError] = useState('')
        const [status, setStatus] = useState('')
        const [pending, setPending] = useState(false)
        const operation = useRef(false)
        const revision = useRef(0)
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
            if (operation.current) return
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
          return () => {
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
        const openDialog = next => {
          setDialogError('')
          setDialog(next)
        }
        const workspaceLabel = title => title === 'default-workspace' ? t('workspace.defaultName') : title
        const sessionLabel = session => session.blank ? t('session.new') : (session.title?.trim() || t('session.untitled'))
        const dialog = workspaceAction === null ? groupDialog : workspaceActionDialog()
        function closeDialog() {
          if (workspaceAction === null) setDialog(null)
          else nativeWorkspace.settleWorkspaceAction()
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

        async function run(action, fromDialog = false) {
          if (operation.current) return
          const { signal } = lifetime.current
          operation.current = true
          revision.current += 1
          setPending(true)
          setStatus('')
          setDialogError('')
          try {
            await action(signal)
            if (!signal.aborted && fromDialog) closeDialog()
          } catch (error) {
            if (!signal.aborted) (fromDialog ? setDialogError : setStatus)(message(error))
          } finally {
            operation.current = false
            if (!signal.aborted) setPending(false)
          }
        }

        async function change(request, signal) {
          const result = await rpc('change', { request }, signal)
          if (!signal.aborted) setData(result)
        }

        function assign(workspaceId, sessionId, groupId, signal) {
          return change({ action: 'assign', workspaceId, sessionId, groupId }, signal)
        }

        function showName(workspace, groupId, group) {
          openDialog({
            key: groupId ?? workspace.workspaceId,
            title: group ? '重命名分组' : `新增分组 · ${workspaceLabel(workspace.title)}`,
            input: { value: group?.name ?? '', maxLength: 80 },
            submit: '保存',
            save: (name, signal) => change(group ? {
              action: 'rename', workspaceId: workspace.workspaceId, groupId, name,
            } : { action: 'create', workspaceId: workspace.workspaceId, name }, signal),
          })
        }

        function showGroupMenu(workspace, groupId, group, count) {
          openDialog({ key: `group:${groupId}`, title: group.name, actions: [
            ['重命名分组', () => showName(workspace, groupId, group)],
            ['删除分组', () => openDialog({
              key: `delete:${groupId}`, title: `删除「${group.name}」？`,
              description: `组内可见的 ${count} 条会话将移回「${workspaceLabel(workspace.title)}」。删除分组会保留全部会话。`,
              submit: '仅删除分组',
              danger: true,
              save: async (_, signal) => {
                await change({ action: 'delete', workspaceId: workspace.workspaceId, groupId }, signal)
                viewFold(setCollapsedGroups, groupId, true)
              },
            })],
          ] })
        }

        function adjustSessionGroup(workspaceId, session, groupId, groups) {
          const choices = groups.filter(([id]) => id !== groupId).map(([id, group]) => [id, group.name])
          if (groupId !== undefined) choices.push(['', '移出分组，返回工作区'])
          openDialog({
            key: `assign:${session.id}`, title: '调整分组',
            ...(choices.length === 0 ? { description: '当前工作区暂无可选分组。' } : {
              choices,
              description: sessionLabel(session), submit: '确定',
              save: async (id, signal) => {
                await assign(workspaceId, session.id, id || null, signal)
                if (id && !signal.aborted) viewFold(setCollapsedGroups, id, true)
              },
            }),
          })
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
          return h('div', {
            key: session.id, className: 'dsh-chat-groups-row', 'data-session-id': session.id,
            'aria-current': session.id === active ? 'true' : undefined, ...getTriggerProps(target),
          },
          button(h(Fragment, null,
            h('span', {
              className: 'dsh-chat-groups-status-dot', 'data-state': status?.state, 'aria-hidden': true,
            }),
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
            iconButton(IconWorkspaceTreeOutlineRegular, `调整「${displayTitle}」的分组`,
              () => adjustSessionGroup(workspaceId, session, groupId, groups), pending || data === null),
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
                iconButton(IconProjectAddOutlineRegular, `在「${title}」中新增分组`,
                  () => showName(workspace), pending || data === null),
              ),
            ),
            expanded && h('div', { className: 'dsh-chat-groups-branch' },
              members.get(undefined)?.map(session => sessionRow(id, session, undefined, groups)),
              groups.map(([groupId, group]) => {
                const rows = members.get(groupId) ?? []
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
                      iconButton(IconEllipsisOutlineRegular, `${group.name}的操作`,
                        () => showGroupMenu(workspace, groupId, group, rows.length), pending),
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
            submit: value => { if (dialog.save) void run(signal => dialog.save(value, signal), true) },
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
        const unregister = ctx.slots.inject(toolbarMount, () => ctx.slots.register({
          name: toolbarMount, id: 'chat-groups-workspace-toolbar',
        }, WorkspaceToolbarButton))
        return () => {
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
