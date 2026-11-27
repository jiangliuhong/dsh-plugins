# DSH Session Monitor 技术设计

- 插件标识 / npm 包名：`dsh-session-monitor`（拟定，发布前确认可用性）
- 英文名：Session Monitor
- 中文名：会话监控
- 状态：设计草案，尚未实现
- 日期：2026-11-27

## 1. 背景与目标

DSH 多工作区并行执行任务时，用户需要逐个检查会话，难以及时发现等待授权、等待回答、任务结束或异常的会话。窗口失焦时尤其明显。本插件借鉴 Paseo Buddy 的状态聚合与通知思路，但不移植原生悬浮窗口。

目标：一眼查看全局执行中和需要处理的会话数量；在后台及时接收提醒；从汇总面板快速进入目标会话。

约束：支持官方 DSH Desktop 和 DSH Web；单一 npm 包；不 fork 或修改官方应用，不注入 Electron 私有 IPC，不启动独立 Swift/AppKit 或 Electron 子进程，不依赖 webServer/webRuntime，不额外开放端口，不读取模型凭证。DSH 完全退出或 Web 页面关闭后，不承诺本地通知持续送达。

## 2. 功能范围

| 功能 | 优先级 | Desktop | Web |
| --- | --- | --- | --- |
| 全工作区会话状态汇总 | P0 | 目标支持 | 目标支持 |
| 固定状态栏、筛选面板 | P0 | 目标支持 | 目标支持 |
| 点击会话跳转 | P0 | 目标支持 | 目标支持 |
| 等待授权、等待回答提醒 | P0 | 通知接口需验证 | 浏览器授权后 |
| 完成、失败通知与未读管理 | P0 | 通知接口需验证 | 浏览器授权后 |
| 通知设置、全部标为已读 | P0 | 目标支持 | 目标支持 |
| 标签页标题、Favicon 角标 | P1 | 不需要 | 目标支持 |
| Dock 角标 | P2（阻塞） | 仅 macOS 且官方开放能力后 | 不支持 |

第一版不包含全局悬浮窗口、托盘常驻、远程多 Host 聚合、跨设备通知、关闭应用后后台推送。表中的目标支持不是已通过兼容性测试的声明。

## 3. 交互设计

在全局布局可用的 UI Slot 注册固定状态栏，不依赖某个工作区或会话页面的挂载。优先使用现有侧边栏工具区；具体 Slot 由 POC 确定。

示意：

    [执行中 3] [待处理 2] [完成未读 4] [失败未读 1]

点击数量展开面板并按状态筛选；默认待处理、失败未读、完成未读、执行中依次展示，同组按最近变化时间倒序。列表显示会话名称、工作区、状态、持续时间或最后变化时间；不展示消息正文和命令参数。点击会话进入其所属工作区和会话。完成、失败支持单独或批量标为已读，打开列表本身不清除未读。待授权或待回答必须由真实处理结果清除，不能通过已读按钮消除。

断线时显示“连接中/数据不可用”，不得把未知状态显示为 0；零计数可配置隐藏。无任务时保留可访问入口。键盘可操作并有明确的无障碍标签，不依赖颜色区分状态。

## 4. 状态模型与统计规则

以一个 Host 的顶层、未归档 Session 为统计单位；子 Agent 不重复计数。多请求仍计为一个待处理会话。每个会话只属于一个展示状态。

| 状态 | 进入条件 |
| --- | --- |
| waiting | 存在尚未解决的授权或用户输入请求 |
| running | 当前轮仍在执行，且无待处理请求 |
| failed_unread | 当前轮异常结束且未读 |
| completed_unread | 当前轮正常结束且未读 |
| idle | 其余情况（包括已读终态） |

展示优先级 waiting > running > failed_unread / completed_unread > idle。取消或主动停止默认不产生完成提醒；若宿主返回未知状态，标记未知并请求重新同步。会话归档、删除后移出统计。新一轮启动时旧一轮未读不再占据当前会话状态。

建议内部数据模型（插件自己的契约，不是 DSH API）：

- SessionKey: hostScope + sessionId
- SessionState: sessionId, workspaceId, title, turnId, executionState, pendingRequests, terminalOutcome, terminalAt, readTurnId, updatedAt
- pendingRequests: requestId, kind (approval/input), createdAt
- Summary: running, waiting, completedUnread, failedUnread, connectionState, revision
- EventIdentity: hostScope + sessionId + turnId + eventKind + requestId（若适用）

完成/失败的已读记录必须绑定 turnId，避免用户点击旧提醒时清除新一轮任务。优先使用宿主公开的未读状态；没有可靠接口时才使用插件自己的记录。原生标记已读和插件标记已读不能混用而产生互相覆盖。

## 5. 技术架构

采用共享状态核心 + DSH 接入层 + 平台能力适配器。

    DSH session snapshot / events
                |
         Session Adapter
                |
         State Reducer + selectors
                |
       +--------+---------+
       |        |         |
     状态栏    会话面板   Notification Router
                          |              |
                    Desktop Adapter   Web Adapter

优先 Client-first：在客户端插件生命周期内建立唯一的会话观察服务，组件只订阅派生状态，避免每次渲染或切换工作区重复注册监听。若全量会话快照、实时事件或持久化无法通过 Client API 实现，则增加 Cordis Host Service，使用受支持的 Typert RPC/事件和 Storage Domain；不要为未验证的需求提前引入 Host。

Host 方案中，Host 负责权威状态与持久化，Client 负责 UI 和本机通知；远程 Host 不应尝试在服务器上展示用户本地桌面通知。RPC 仅允许当前授权用户读取或修改自己的可见会话记录，不开放任意系统命令。

可参考同仓库 dsh-chat-groups 的 bundle、client 注入服务、storageDomain、Typert 注册及 ctx.effect 清理模式。所有具体 DSH 服务名、事件字段、Slot 名、导航 API 必须依据目标版本源码/声明及实际安装包验证，不把以下设计概念当作官方 API。

### 5.1 初始快照与事件一致性

1. 注册观察器并缓冲增量事件，读取全部可见工作区及会话状态；分页时必须完整读取。
2. 根据宿主 revision/事件序列（若提供）合并快照和缓冲事件；无法可靠排序时重新取权威快照，不猜测新旧顺序。
3. 全量构建状态后一次性发布 Summary；增量更新仅影响相关会话。
4. 重连重新获取快照，清理已经删除的会话和失效请求；连接断开停止发布可信计数。
5. 去重并忽略旧轮次事件，处理结束、请求解除、取消、归档、删除等边界。
6. 禁用插件、连接替换或页面卸载时解除订阅、清理定时器并恢复由插件修改的页面标题/图标。

仅实时新事件触发通知，初始化及重连历史快照不批量弹通知。未读恢复依赖宿主可查询终态或已持久化记录；不保证补发断线期间的通知。事件监听优先于轮询；若必须轮询，采用有限间隔、退避及取消机制。

### 5.2 持久化

默认使用宿主提供的可靠未读数据。否则持久化最少的 readTurnId、通知去重记录及用户设置。若使用 Client 本地存储，按 Host 和账号隔离，并明确仅当前浏览器/客户端生效；如需跨标签页或 Desktop/Web 同步，使用经验证的 Host Storage Domain，并处理多端竞争。删除会话时清理对应记录，通知去重缓存设上限与过期策略。不持久化聊天正文、凭证或完整工作区路径。

### 5.3 通知

默认触发：新的待授权、待回答、正常完成、执行失败；不对运行中的每次状态更新通知。仅在目标会话未处于用户可见且激活状态时通知；用户可配置是否在前台也提醒。通知只显示会话标题（可关闭）和状态。对重复事件按 EventIdentity 去重，对短时间多事件合并或限频；多个 Web 标签页需选出单一通知发送者或通过共享去重避免重复提醒。

Web：使用 Notification API，检测安全上下文、浏览器支持和权限；权限申请由用户点击设置触发，拒绝后不反复弹权限框，保留应用内提示。页面关闭、浏览器休眠或系统勿扰可能影响送达。不把 Service Worker / Push 作为第一版前提。

Desktop：先验证官方 Renderer 的 Notification 支持、权限、最小化/隐藏窗口时的行为和通知点击回调。仅使用受支持的能力；不启动通知子进程作为隐式降级。若不可用，明确显示系统通知不可用，保留应用内状态与提醒。通知点击优先通过受支持的会话导航服务；操作系统前台激活能力若不可用，不承诺自动恢复窗口。

### 5.4 平台适配及角标

共享接口（内部设计）：supportsBadge(), setBadge(summary), clearBadge(), supportsNotification(), notify(event), dispose()。按运行时实际能力检测，而非仅判断 user-agent 或 operating system。

- Web：使用页面标题前缀 `[3/2] DeepSeek Harness`（执行中/待处理），可选 Favicon 绘制待处理数字。保留宿主标题变化，卸载时仅恢复自己设置的内容；全零时清除前缀。
- Desktop：macOS Dock 的 Electron app.dock.setBadge 属于 Main Process，Host/Renderer 不能据此直接调用。当前未确认官方提供第三方桥接接口，因此 Dock 功能是阻塞的 P2，不是 MVP 验收要求。官方开放受支持接口后再实现；其他平台按能力降级。
- Dock 建议默认显示待处理数，用户可切换为执行中/待处理组合字符串（例如 3/2，实际系统显示效果须测试）；零时清空。角标不承诺双色显示。Dock 自动隐藏时也不是始终可见。

### 5.5 设置

通知总开关、授权/回答/完成/失败分类开关、前台通知开关、隐私模式（不显示会话名）、零计数隐藏、Web 标题/Favicon 开关、Dock 角标模式（仅可用时出现）。默认打开核心提醒，尊重系统权限；不支持的功能显示原因而非可操作的假开关。

## 6. 计划目录

以下是未来实现结构，本次只创建 DESIGN.md。

    dsh-session-monitor/
      DESIGN.md
      README.md
      package.json
      cordis.patch.yml
      src/
        core/
          state.ts
          reducer.ts
          selectors.ts
          dedupe.ts
        client/
          index.ts
          session-adapter.ts
          navigation.ts
          status-bar.tsx
          session-panel.tsx
          settings.tsx
        platform/
          capabilities.ts
          web.ts
          desktop.ts
        host/                 # 仅必要时引入
          index.ts
          storage.ts
          protocol.ts
      tests/

TS/React 为拟定技术栈，产物编译为官方 Bundle 可加载的 ESM；借鉴 dsh-chat-groups 的 package exports、client inject、cordis.patch.yml。具体依赖与版本范围通过 POC 确认，不直接复制其他插件的 engines。

## 7. 实施计划及验证门槛

| 阶段 | 任务 | 通过标准 |
| --- | --- | --- |
| POC | 验证官方 Desktop/Web 加载、全工作区快照、事件、UI Slot、导航、通知 | 记录实际 API、版本和权限；明确缺失能力 |
| 1 | 状态 reducer、去重、初始化与重连 | 单元测试覆盖状态转移及竞态 |
| 2 | 状态栏、面板、导航、未读设置 | 切换工作区不丢统计，操作可达 |
| 3 | 通知、Web 标题/Favicon | 后台提醒、权限降级、多标签去重 |
| 4 | 打包、回归、文档 | 两端实装通过，无额外进程 |
| 后续 | 官方 Dock 能力 | 公开接口可用并通过真实 macOS 测试 |

测试基线优先覆盖用户正在使用的官方 Desktop 版本及匹配 Web 版本，再选择当前稳定版本验证；0.2.2-rc.5 / 0.2.3-alpha.2 仅作为现有同仓库插件的历史参考，不宣称本插件兼容。

## 8. 验收用例

- 两个工作区各有执行中会话、一个待授权会话，统计正确且待授权不重复计入执行中。
- 同一会话两个未解决请求仍只计一个待处理；仅最后一个解除时退出 waiting。
- 先启动任务再安装插件，初始化能够识别已有活跃会话；历史结束不误弹通知。
- 同一完成事件重复发送只通知一次；旧轮次已读请求不清除新轮次未读。
- 主动取消不显示为正常完成；失败、归档、删除正确更新。
- 切换工作区、隐藏侧栏、最小化 Desktop 后观察器不重复挂载；真实连接断开时显示不可用。
- 恢复连接后重新同步，不显示虚假零计数、不重复通知。
- 通知权限拒绝、接口不存在、Dock 不支持时插件仍正常运行。
- Web 双标签页不重复通知；标题与 Favicon 在禁用插件后恢复。
- 点击列表进入正确会话；通知点击导航在实际支持的平台验证，不能激活窗口时明确降级。
- 与 dsh-chat-groups 同时安装，UI Slot、会话导航、存储和插件卸载互不干扰。
- 不启动额外独立进程、不新增监听端口、不读取模型密钥。

## 9. 发布规则

遵循仓库 AGENTS.md。进入实现阶段、具备可打包的 package.json 后，将标识、目录、npm 包名、dist-tag 加入 .github/npm-plugins.json，并更新根 README 插件列表；配置 npm Trusted Publisher（jiangliuhong/dsh-plugins、publish-npm.yml）。发布 tag 采用 dsh-session-monitor-vX.Y.Z，版本必须与 package.json 一致，仅用户明确要求发布时才创建 tag。本次为设计目录初始化，不注册尚不存在的 npm 包或触发发布。

## 10. 风险和待确认事项

- 官方 DSH Desktop 是否向 Client 暴露完整会话状态及可用通知接口。
- 等待回答、授权结束、取消、完成等事件真实字段及初始化时 pending 请求的恢复方式。
- 全局 Slot 生命周期与 dsh-chat-groups 的兼容性。
- 宿主是否有可公开查询/修改的已读状态；否则插件独立管理。
- 官方 Dock 桥接尚未确认，不采用私有 IPC、app.asar 修改或原生子进程绕过。
- 页面关闭或挂起、系统通知权限、远程 Host 与本机客户端断开均可能影响通知。

参考：
- [同仓库 dsh-chat-groups](../dsh-chat-groups/)
- [仓库发布规则](../AGENTS.md)
- [Paseo Buddy](https://github.com/jiangliuhong/paseo-buddy)
- [DSH 官方仓库](https://github.com/deepseek-ai/deepseek-harness)
- [Electron Dock API](https://www.electronjs.org/docs/latest/api/dock)
- [Web Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
