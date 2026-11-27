// DSH's browser loader supplies React from the application runtime.
window.__ModuleLoader__.load({
  id: 'dsh-chat-groups',
  factory(require) {
    const {
      createElement: h, Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
    } = require('react')
    const { createPortal } = require('react-dom')
    const {
      Button, HoverCard, HoverCardGroup, Menu, MenuSurface, Modal, StateDot, Tooltip, relativeTime, useDismissOnOutsidePointer,
      IconEditOutlineRegular, IconEllipsisOutlineRegular, IconFlatListOutlineRegular, IconTrashOutlineRegular,
      IconBranchOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
      IconNewChatOutlineRegular, IconProjectAddOutlineRegular, IconWorkspaceTreeOutlineRegular,
    } = require('@deepseek-ai/dsh-client-ui-primitives')
    const slot = 'sidebar.workspaces'
    const sessionActionSlot = 'sidebar.workspaces.session.row.action'
    const trailingSlot = 'chat-groups.session.row.trailing'
    const hoverSlot = 'chat-groups.session.row.hover'
    const heroSlot = 'conversation.hero.options'
    const recoverySlot = 'conversation.input.dock'
    const worktreeLocale = 'chat-groups-worktrees'
    const worktreeCopy = {
      zh: {
        choose: '选择已有工作树', label: '工作树', workspace: '工作区默认目录',
        detached: '分离 HEAD · {commit}', switching: '正在切换工作树…', retry: '重新加载工作树',
        forgeCancelled: '已取消新建工作树。请先切回工作区默认目录，再勾选「新建工作树」。',
        recover: '重新选择工作树', resend: '工作目录已确认，请重新发送消息。',
        forge: '请先取消「新建工作树」，再选择已有工作树。', unavailable: '当前无法切换工作树。',
      },
      en: {
        choose: 'Select an existing worktree', label: 'Worktree', workspace: 'Workspace default directory',
        detached: 'Detached HEAD · {commit}', switching: 'Switching worktree…', retry: 'Reload worktrees',
        forgeCancelled: 'New worktree was cancelled. Switch to the workspace default directory before selecting New worktree.',
        recover: 'Select a worktree again', resend: 'Working directory confirmed. Send your message again.',
        forge: 'Clear New worktree before selecting an existing worktree.', unavailable: 'Worktree selection is currently unavailable.',
      },
    }
    const absentSource = { subscribe: () => () => {}, getSnapshot: () => undefined }
    const worktreeStyle = `
      .dsh-chat-groups-worktree { display: inline-flex; align-items: center; gap: 4px;
        max-width: min(22ch, 25vw); padding: 3px 5px; background: transparent; border: 0;
        border-radius: var(--dsw-radius-sm); color: var(--dsw-alias-label-secondary); font: inherit; cursor: pointer; }
      [data-slot="conversation.hero.options"]:has(> style[data-existing-worktree]) [data-forge-worktree] { display: none; }
      .dsh-chat-groups-worktree:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dsh-chat-groups-worktree:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); }
      .dsh-chat-groups-worktree[aria-disabled=true] { opacity: .55; cursor: default; }
      .dsh-chat-groups-worktree > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dsh-chat-groups-worktree-option { display: grid; gap: 2px; white-space: normal; overflow-wrap: anywhere; }
      .dsh-chat-groups-worktree-option small { color: var(--dsw-alias-label-secondary); }
    `
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
      .dsh-chat-groups-row > .dsh-chat-groups-label > .dsh-chat-groups-trailing { flex: none; margin-left: auto; }
      .dsh-chat-groups-trailing { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-tertiary); }
      .dsh-chat-groups-row-worktree { display: inline-flex; align-items: center; }
      .dsh-chat-groups-trailing:has([data-forge-row-worktree]) .dsh-chat-groups-row-worktree { display: none; }
      .dsh-chat-groups-row-time { flex: none; font-size: 10px; line-height: 16px; margin-inline-end: -1px; }
      @media (hover: none) { .dsh-chat-groups-row-time:not([aria-hidden]) { display: none; } }
      .dsh-chat-groups-hover { display: flex; flex-direction: column; gap: 8px; }
      .dsh-chat-groups-hover-title { font-size: 14px; line-height: 20px; overflow-wrap: break-word; color: var(--dsw-alias-hovercard-label-primary); }
      .dsh-chat-groups-hover-path, .dsh-chat-groups-hover-time { font-size: 12px; line-height: 16px; color: var(--dsw-alias-hovercard-label-secondary); }
      .dsh-chat-groups-hover-path { word-break: break-all; }
      .dsh-chat-groups-hover-status { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 20px; color: var(--dsw-alias-hovercard-label-tertiary); }
      @media (hover: hover) {
        .dsh-chat-groups-row:is(:hover, [data-session-menu-open]) .dsh-chat-groups-trailing,
        html[data-input-modality='keyboard'] .dsh-chat-groups-row:focus-within .dsh-chat-groups-trailing { display: none; }
        .dsh-chat-groups-row[data-session-menu-open] > .dsh-chat-groups-actions { display: flex; }
      }
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
      ['approval', ['status.waitingApproval', 'status.compact.approval']],
      ['plan-review', ['status.planReview', 'status.compact.planReview']],
      ['question', ['status.waitingAnswer', 'status.compact.answer']],
    ])

    function sessionHoverPath(path, home) {
      const windowsPath = /^(?:[A-Za-z]:[\\/]|\\\\)/
      if (!home || windowsPath.test(home) || windowsPath.test(path)) return path
      const root = home.replace(/\/+$/, '')
      if (!root) return path
      if (path.replace(/\/+$/, '') === root) return '~'
      return path.startsWith(`${root}/`) ? `~${path.slice(root.length)}` : path
    }

    function sessionTime(updatedAt, now, t, { ago = false } = {}) {
      const { unit, n } = relativeTime(updatedAt, now)
      if (unit === 'now') return t('time.now')
      const label = t(`time.${unit}`, { n })
      return ago ? t('time.ago', { t: label }) : label
    }

    function sessionStatuses(session, catalog, statuses, t) {
      const status = statuses.get(session.id)
      const pending = pendingStatusLabel.get(status?.pendingInteraction?.kind)
      const children = catalog.projectionsBySession[session.id]?.values.subagentCatalog ?? []
      const runningChildren = children.filter(({ id }) => statuses.get(id)?.running ?? catalog.byId[id]?.running).length
      const result = []
      if (pending !== undefined) result.push({ state: 'warning', label: t(pending[0]), trailingLabel: t(pending[1]) })
      else if (status?.running ?? session.running) result.push({ state: 'ongoing', label: t('status.running') })
      if (runningChildren) {
        const key = runningChildren === 1 ? 'status.subagentsRunning.one' : 'status.subagentsRunning.other'
        result.push({ state: 'ongoing', label: t(key, { n: runningChildren }) })
      }
      if (result.length) return result
      return status?.completionUnread
        ? [{ state: 'done', label: t('status.completed') }]
        : [{ state: 'idle', label: t('status.idle') }]
    }

    function SessionHoverContent({ session, worktreeRoot, displayTitle, home, now, states, renderSlot, t }) {
      const directory = worktreeRoot ?? session.cwd
      return h('div', { className: 'dsh-chat-groups-hover' },
        h('div', { className: 'dsh-chat-groups-hover-title' }, displayTitle),
        directory && h('div', { className: 'dsh-chat-groups-hover-path', title: directory }, sessionHoverPath(directory, home)),
        !session.blank && h('div', { className: 'dsh-chat-groups-hover-time' }, sessionTime(session.updatedAt, now, t, { ago: true })),
        renderSlot(hoverSlot, { sessionId: session.id }),
        states.map(({ state, label }) => h('div', { key: label, className: 'dsh-chat-groups-hover-status' },
          h(StateDot, { state }), h('span', null, label))),
      )
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

    function ActionMenu({ Icon, label, disabled, items, onSelect, panel, triggerRef, anchorName, onOpenChange }) {
      const [open, setMenuOpen] = useState(false)
      function setOpen(next) {
        setMenuOpen(next)
        onOpenChange?.(next)
      }
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

    // The catalogue's cwd is the launch directory. The projection follows cd
    // and existing-worktree selections, including cached historical sessions.
    const rowDirectory = session => session.projectionValues?.workingDirectory ?? session.cwd

    function SessionCard({ session, worktreeRoot, displayTitle, states, home, now, renderSlot, t, menuOpen, rowProps, onOpen, nativeActions, groupAction }) {
      const [groupMenuOpen, setGroupMenuOpen] = useState(false)
      const primary = !session.blank && states[0].state !== 'idle' ? states[0] : undefined
      const title = session.title?.trim() ?? ''
      const anchor = h('div', { ...rowProps, 'data-session-menu-open': menuOpen || groupMenuOpen ? '' : undefined },
        button(h(Fragment, null,
          h('span', { className: 'dsh-chat-groups-status' }, primary && h(StateDot, { state: primary.state })),
          h('span', null, displayTitle),
          (!session.blank || worktreeRoot) && h('span', { className: 'dsh-chat-groups-trailing' },
            !session.blank && h('span', { className: 'dsh-chat-groups-row-time', 'aria-hidden': primary?.trailingLabel ? true : undefined },
              primary?.trailingLabel ?? sessionTime(session.updatedAt, now, t)),
            !session.blank && renderSlot(trailingSlot, { sessionId: session.id }),
            worktreeRoot && h('span', { className: 'dsh-chat-groups-row-worktree', role: 'img', 'aria-label': worktreeRoot, title: worktreeRoot },
              h(IconBranchOutlineRegular, { size: 13, 'aria-hidden': true }))),
        ), onOpen, { 'aria-label': primary ? `${displayTitle} · ${primary.label}` : displayTitle }),
        h('span', { className: 'dsh-chat-groups-actions' }, nativeActions,
          h(ActionMenu, { ...groupAction, onOpenChange: setGroupMenuOpen })),
      )
      return h(HoverCard, {
        anchor, content: h(SessionHoverContent, { session, worktreeRoot, displayTitle, home, now, states, renderSlot, t }),
        grouped: true, openDelayMs: 800, disabled: menuOpen || groupMenuOpen,
        copyText: session.blank || !title ? undefined : title, copyLabel: t('copy'), copiedLabel: t('hover.copied'),
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

      const subscribeHero = listener => ctx.slots.subscribe(heroSlot, listener)
      const currentForge = () => ctx.slots.entriesOfSlot(heroSlot).find(entry => entry.options.id === 'forge-panel.worktree')

      function WorktreeOption(props) {
        const workspace = props.useWorkspaces(list => list.items.find(workspace => workspace.sessionIds.includes(props.sessionId)))
        const generation = useSource(connection.generation)
        if (!workspace || !generation) return null
        return h(WorktreeSelector, { ...props, generation, workspacePath: workspace.path, key: JSON.stringify([props.sessionId, workspace.workspaceId, generation.id]) })
      }

      function RecoveryOption(props) {
        const idle = props.useLifecycle(session => session?.openState === 'open' && !session.blank && !session.running)
        return idle ? h(WorktreeOption, { ...props, recoveryDock: true }) : null
      }

      function WorktreeSelector({ sessionId, generation, workspacePath, useDirectory, recoveryDock, t }) {
        const directory = useDirectory(value => value)
        const forge = useSyncExternalStore(subscribeHero, currentForge)
        const panel = useMemo(() => recoveryDock ? absentSource : forge?.inject?.(sessionId)?.hooks?.panel ?? absentSource, [forge, sessionId, recoveryDock])
        const forgeBlocked = useSyncExternalStore(
          useCallback(listener => panel.subscribe(listener), [panel]),
          useCallback(() => {
            const worktree = panel.getSnapshot()?.state?.worktree
            return !!(worktree?.request || worktree?.creation)
          }, [panel]),
        )
        const [state, setState] = useState(null)
        const [error, setError] = useState('')
        const [open, setOpen] = useState(false)
        const [pending, setPending] = useState(false)
        const read = useRef(null)
        const mutation = useRef(null)
        // Forge's request and cancellation can arrive in one render batch. Observe the
        // durable live event so the explanation also reaches windows that missed the toggle.
        useEffect(() => {
          if (recoveryDock) return
          const events = sessions.binding(sessionId)?.eventSource
          return events?.subscribe(() => {
            if (!mutation.current && (!state || state.currentPath === state.defaultPath)) return
            const { change } = events.getSnapshot()
            if (change.kind === 'append' && change.entries.some(({ event }) =>
              event.type === 'plugin:client-ui-forge/worktree' && event.data.action === 'cancel')) {
              ctx.contextMenus.notify(t('forgeCancelled'))
            }
          })
        }, [sessionId, recoveryDock, state?.currentPath, state?.defaultPath, t])
        const active = useCallback(signal => !signal.aborted && connection.generation.getSnapshot() === generation, [generation])

        const reload = useCallback(async () => {
          if (connection.generation.getSnapshot() !== generation || mutation.current) return
          read.current?.abort()
          const controller = new AbortController()
          read.current = controller
          try {
            const request = recoveryDock ? { sessionId, recoveryOnly: true } : { sessionId }
            const snapshot = await rpc('listWorktrees', { request }, controller.signal)
            if (active(controller.signal)) {
              setState(snapshot)
              setError('')
            }
          } catch (failure) {
            if (active(controller.signal)) {
              setState(null)
              setError(message(failure))
              setOpen(false)
            }
          }
        }, [active, generation, sessionId, recoveryDock])

        useEffect(() => {
          if (forgeBlocked) setOpen(false)
          void reload()
          window.addEventListener('focus', reload)
          return () => {
            read.current?.abort()
            window.removeEventListener('focus', reload)
          }
        }, [reload, directory, forgeBlocked])
        useLayoutEffect(() => () => { read.current?.abort(); mutation.current?.abort() }, [])

        const disabled = pending || forgeBlocked || state?.editable === false
        async function select(path) {
          setOpen(false)
          if (!state || disabled || mutation.current || (path === state.currentPath && !state.recovering)) return
          if (path !== state.defaultPath && !state.worktrees.some(item => item.path === path && item.selectable)) return
          const controller = new AbortController()
          mutation.current = controller
          read.current?.abort()
          setPending(true)
          // Composer blocks are session-scoped but shared with other plugins. Only
          // release our own block if another contributor has not replaced it.
          const blocks = ctx.get('conversation').blocks
          const block = { reason: t('switching') }
          const store = blocks.storeFor(sessionId)
          const hold = () => { if (store.getSnapshot() === undefined) blocks.set(sessionId, block) }
          const unsubscribe = store.subscribe(hold)
          hold()
          const release = () => {
            unsubscribe()
            if (blocks.storeFor(sessionId).getSnapshot() === block) blocks.set(sessionId, undefined)
          }
          controller.signal.addEventListener('abort', release, { once: true })
          try {
            const snapshot = await rpc('applyWorktree', { request: { sessionId, path } }, controller.signal)
            if (active(controller.signal)) {
              setState(snapshot)
              if (recoveryDock) ctx.contextMenus.notify(t('resend'))
            }
          } catch (failure) {
            if (active(controller.signal)) ctx.contextMenus.notify(message(failure))
          } finally {
            controller.signal.removeEventListener('abort', release)
            release()
            mutation.current = null
            if (active(controller.signal)) {
              setPending(false)
              void reload()
            }
          }
        }

        const currentPath = state?.currentPath ?? directory
        const defaultPath = state?.defaultPath ?? workspacePath
        const existing = !recoveryDock && currentPath && defaultPath && currentPath !== defaultPath
        const styles = h('style', { 'data-existing-worktree': existing ? '' : undefined }, worktreeStyle)
        if (!state) return error ? h(Fragment, null, styles,
          h('button', { type: 'button', className: 'dsh-chat-groups-worktree', title: error,
            'aria-label': `${t('retry')} · ${error}`, onClick: reload }, t('retry'))) : existing ? styles : null
        if (recoveryDock && !state.recovering) return null
        if (!state.recovering && state.currentPath === state.defaultPath && !state.worktrees.some(item => item.selectable && item.path !== state.defaultPath)) return null
        const name = item => item.branch ?? t('detached', { commit: item.commit.slice(0, 8) })
        const selected = state.worktrees.find(item => item.path === state.currentPath)
        const defaultBranch = state.worktrees.find(item => item.path === state.defaultPath)
        const option = (path, label, blockedReason) => ({
          id: path, disabled: !!blockedReason, label: h('span', { className: 'dsh-chat-groups-worktree-option' },
            h('span', null, label), h('small', null, path), blockedReason && h('small', null, blockedReason)),
        })
        const defaultLabel = defaultBranch ? `${t('workspace')} · ${name(defaultBranch)}` : t('workspace')
        const items = [option(state.defaultPath, defaultLabel),
          ...state.worktrees.filter(item => item.path !== state.defaultPath)
            .map(item => option(item.path, name(item), item.selectable === false && (item.blockedReason || t('unavailable'))))]
        const label = state.currentPath === state.defaultPath ? t('label') : selected ? name(selected) : state.currentPath
        const currentLabel = state.currentPath === state.defaultPath ? defaultLabel : label
        const disabledHint = pending ? t('switching') : forgeBlocked ? t('forge') : t('unavailable')
        const hint = `${disabled ? disabledHint : t('choose')} · ${currentLabel} · ${state.currentPath}`
        return h(Fragment, null, styles, h(Menu, {
          open: open && !disabled, items, selectedId: state.currentPath, portal: true, autoFocus: true, side: 'bottom', align: 'end',
          onClose: () => setOpen(false), onSelect: select,
          anchor: h('button', {
            className: 'dsh-chat-groups-worktree', type: 'button', 'aria-disabled': disabled, title: hint,
            'aria-label': hint, 'aria-busy': pending, 'aria-haspopup': 'menu', 'aria-expanded': open && !disabled,
            onClick() {
              if (disabled) return ctx.contextMenus.notify(disabledHint)
              if (!open) void reload()
              setOpen(!open)
            },
          }, h('span', null, pending ? t('switching') : state.recovering ? t('recover') : label), h('small', { 'aria-hidden': true }, '▾')),
        }))
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
        renderFactorySlot, renderSlot, useSessionStatus, t,
      }) {
        const workspaceList = useSource(workspaces.list)
        const catalog = useSource(sessions.list)
        const statuses = useSessionStatus(snapshot => snapshot)
        const { home } = useSource(nativeWorkspace.hooks.hostInfo)
        const menuTarget = useSource(nativeWorkspace.hooks.contextMenuTarget)
        const now = Date.now()
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
        const visibleDirectories = new Set()
        for (const workspace of workspaceList.items) {
          if (!wide || collapsedWorkspaces.has(workspace.workspaceId)) continue
          for (const id of workspace.sessionIds) {
            const session = catalog.byId[id]
            if (!session || archived.has(id) || session.origin === 'subagent' || (session.blank && id !== active)
                || collapsedGroups.has(groupBySession[id]) || session.projectionValues?.forgeWorktree) continue
            const directory = rowDirectory(session)
            if (directory) visibleDirectories.add(directory)
          }
        }
        // Session status updates are frequent. Key lookups by the unique paths
        // on screen so a status change or a shared checkout costs no extra RPC.
        const directoryKey = JSON.stringify([...visibleDirectories].sort())
        const [linkedRoots, setLinkedRoots] = useState({})
        useEffect(() => {
          const paths = JSON.parse(directoryKey)
          const controller = new AbortController()
          let revision = 0
          async function refresh() {
            const current = ++revision
            const roots = {}
            for (let i = 0; i < paths.length; i += 512) {
              const request = { paths: paths.slice(i, i + 512) }
              try {
                Object.assign(roots, await rpc('linkedWorktreeRoots', { request }, controller.signal))
              } catch { return }
              if (controller.signal.aborted || current !== revision) return
            }
            setLinkedRoots(roots)
          }
          if (generation !== undefined) void refresh()
          if (generation !== undefined && paths.length) window.addEventListener('focus', refresh)
          return () => { controller.abort(); window.removeEventListener('focus', refresh) }
        }, [generation, directoryKey])
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
          const target = session.blank ? undefined : {
            kind: 'session', value: { sessionId: session.id, displayTitle: session.title?.trim() ?? '' },
          }
          const destinations = groups.filter(([id]) => id !== groupId).map(([id, group]) => ({ id, label: group.name }))
          if (groupId !== undefined) {
            if (destinations.length) destinations.push({ type: 'separator', id: 'ungroup-separator' })
            destinations.push({ id: '', label: '移出分组，返回工作区' })
          }
          return h(SessionCard, {
            worktreeRoot: session.projectionValues?.forgeWorktree?.path ?? linkedRoots[rowDirectory(session)],
            key: session.id, session, displayTitle, states: sessionStatuses(session, catalog, statuses, t), home, now, renderSlot, t,
            menuOpen: menuTarget?.kind === 'session' && menuTarget.value.sessionId === session.id,
            onOpen: () => openSession(session.id),
            rowProps: {
              className: 'dsh-chat-groups-row', 'data-session-id': session.id,
              'aria-current': session.id === active ? 'true' : undefined, ...getTriggerProps(target),
            },
            nativeActions: target && h('span', { className: 'dsh-chat-groups-native-actions' },
              renderFactorySlot('contextMenu.button', {
                target, label: t('actions.session.aria', { name: displayTitle }), className: 'dsh-chat-groups-icon',
              }),
              nativeSessionActions.map(({ key, Component, callbacks, hooks }) => h(Component, {
                key, ...callbacks, t, useSessionAccess, sessionId: session.id, displayTitle: target.value.displayTitle,
                useArchived: selector => selector(useSource(hooks.archived)),
                usePinned: hooks.pinned && (selector => selector(useSource(hooks.pinned))),
              })),
            ),
            groupAction: {
              Icon: IconWorkspaceTreeOutlineRegular, label: `调整「${displayTitle}」的分组`,
              disabled: pending || data === null,
              items: destinations.length ? destinations : [{ id: 'empty', label: '当前工作区暂无可选分组', disabled: true }],
              onSelect: id => { void run(async signal => {
                await assign(workspaceId, session.id, id || null, signal)
                if (id && !signal.aborted) viewFold(setCollapsedGroups, id, true)
              }) },
            },
          })
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
            h(HoverCardGroup, null, workspaceList.items.map(workspaceRows)),
          ),
          dialog && h(Dialog, { key: dialog.key, dialog, pending, error: dialogError, t,
            close: closeDialog,
            submit: value => { void run(signal => dialog.save(value, signal), { close: closeDialog, onError: setDialogError }) },
          }),
        )
      }

      // Child slots belong to their declaring sidebar. Mirror the active native
      // decorations into our own slots so the renderer supplies their hooks and locale.
      function mirrorRowSlot(source, destination) {
        ctx.slots.inject(destination, () => {
          const mounted = new Map()
          function sync() {
            const winners = new Set(ctx.slots.entriesOfSlot(source))
            for (const [entry, dispose] of mounted) {
              if (winners.has(entry)) continue
              dispose()
              mounted.delete(entry)
            }
            for (const entry of winners) {
              if (mounted.has(entry)) continue
              const { id, order } = entry.options
              mounted.set(entry, ctx.slots.register({
                name: destination, id, order, locale: entry.locale, inject: entry.inject, store: entry.store,
              }, entry.component))
            }
          }
          sync()
          const unsubscribe = ctx.slots.subscribe(source, sync)
          return () => {
            unsubscribe()
            for (const dispose of mounted.values()) dispose()
          }
        })
      }
      mirrorRowSlot('sidebar.session.row.trailing', trailingSlot)
      mirrorRowSlot('sidebar.session.row.hover', hoverSlot)

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
          () => ctx.slots.register({
            name: slot, locale: 'workspace', priority: -10,
            children: {
              [trailingSlot]: { kind: 'list', scope: 'root', inline: true },
              [hoverSlot]: { kind: 'list', scope: 'root' },
            },
          }, GroupedSidebar))
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
        const unregisterWorktrees = ctx.slots.inject(heroSlot, () => {
          const releaseLocale = ctx.locale.register(worktreeLocale, worktreeCopy)
          const inject = sessionId => {
            const binding = sessions.binding(sessionId)
            return { sessionId, hooks: {
              workspaces: workspaces.list,
              directory: binding?.session.projections.faceOf('workingDirectory') ?? absentSource,
            } }
          }
          const releaseEntry = ctx.slots.register({
            name: heroSlot, id: 'chat-groups.existing-worktree', order: -5, locale: worktreeLocale, inject,
          }, WorktreeOption)
          const releaseRecovery = ctx.slots.inject(recoverySlot, () => ctx.slots.register({
            name: recoverySlot, id: 'chat-groups.recover-worktree', locale: worktreeLocale,
            inject: sessionId => {
              const face = inject(sessionId)
              face.hooks.lifecycle = sessions.binding(sessionId)?.session ?? absentSource
              return face
            },
          }, RecoveryOption))
          return () => { releaseRecovery(); releaseEntry(); releaseLocale() }
        })
        const unregister = ctx.slots.inject(toolbarMount, () => ctx.slots.register({
          name: toolbarMount, id: 'chat-groups-workspace-toolbar',
        }, WorkspaceToolbarButton))
        return () => {
          restoreWorkspaceEntry()
          restoreFork()
          groupChannel?.close()
          groupChannel = undefined
          exit()
          unregisterWorktrees()
          unregister()
        }
      })
    }

    return {
      name: 'dsh-chat-groups',
      inject: ['contextMenus', 'slots', 'sessions', 'workspaces', 'connection', 'uiWorkspace', 'remoteAccess', 'locale', 'conversation'],
      apply,
    }
  },
})
