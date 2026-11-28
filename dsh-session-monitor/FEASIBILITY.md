# 核心可行性验证（2026-11-27）

基线：官方 Desktop 安装包，`@deepseek-ai/dsh` 0.2.2-rc.5，Electron 44.7.0。以下将安装版代码契约、隔离运行结果和仍需真实窗口验证的行为分开。未安装插件、修改 profile、读取用户会话正文或使用模型调用。路径均相对于安装包的 `node_modules/@deepseek-ai/`。

## 入口与导航（源码确认）

- `dsh-client-ui-layout/src/client/index.ts:89–107,192–205`：`shell.bottom` 是根级单占位插槽，跨主面板保持挂载；默认布局空置，不等于第三方插件不会占用。存在冲突时可提供 `sidebar.panellist` + `main` 面板入口。不要接管 `sidebar.workspaces`。
- `dsh-client-ui-workspace/src/client/navigation.ts:39–45`：`uiWorkspace.openSession(target)` 是选择会话并展示对话的接口。打开会话不等于一定能接管另一个客户端收到的请求。

## 待处理：不要从卡片直接计数

`dsh-client-ui-session/src/client/index.ts:486–505` 只选出当前客户端每个会话的最高优先级交互。用户可以隐藏仍可作答的问题，也可以回看已经结束的问题（`dsh-client-ui-user-questions/src/client/index.ts:73–81,172–191`）。卡片有无既不能证明有未决请求，也不能证明没有。

| 隔离场景 | 观察结果 | 对设计的影响 |
| --- | --- | --- |
| 两次并发调用正式包 `ApprovalService.request()`，用内存 Session 记录事件，在分发后才开始按审计 UUID 重算；分别拒绝、允许 | 未闭合审计对数 2 → 1 → 0 | 可用作 Host 元数据投影的输入；会话数应是 1 → 1 → 0。此次不是跨端投递实验。 |
| 将同一服务的策略改为 `never` | 没有调用应答方，仍产生 `approval/asked` 和 `approval/decided` | 不能收到 `asked` 就弹“请审批”。审计对也不证明某个客户端有权代答。 |
| 用正式问题投影重放同一内存日志 | 默认 legacy 阻塞提问不进入投影；timed 提问得到 `open`，超时返回 pending 后是 `continued`，补答后清空 | `continued` 是仍可补答，不是执行仍被阻塞；legacy 不能用此投影补回。 |
| 以 `origin: 'subagent'` 调用正式提问服务 | 拒绝：`DELEGATED_CALLER` | 官方进程内子代理不是普通 fork；前者授权策略是 `never`，不要因它尝试提权而让父会话亮灯。 |

实验使用安装版 Electron 的 Node 模式加载正式包导出，使用内存 Session、注册入口和应答方，不使用用户 Host。对应源码：`dsh-user-approval/src/index.ts:242–260,293–310`；`dsh-user-questions/src/projection.ts:218–230,315–331`；`dsh-user-questions/src/index.ts:137–149`。全局列表 `phase:ready` 重连后不复位（`dsh-api-session-controller/src/client/sessions/manager.ts:34–42`）；不能用它单独判断重连期间数据已可信。

## 会话目录与终态

- `dsh-api-session-controller/src/client/sessions/service.ts:29–69`：遍历 `ctx.sessions.list` 的 `ids` 再查 `byId`，不要直接统计 `byId`（可含已保留子代理）。与 `ctx.workspaces.list` 的归档集合联查；保留未分组会话，以 `origin:'subagent'` 而非存在父 ID 排除子代理。列表 `updatedAt` 不是状态变化时间。
- 用正式产物 `dsh-client-ui-session/lib/client.js` 的 `UiSession` 和内存会话实测：初始空闲不产生未读；两个交互只显示优先级较高的一个，撤销后依次显露另一项、清空；非主视图的 running 从 true 变 false 产生未读，进入主视图清除。该标志按 Session 存在本客户端内存中，没有轮号与结束原因（`src/client/index.ts:508–543`）。
- `dsh-session/src/types.ts:203–238,296–303`：`turn/end` 带轮号与结束原因。若要承诺分轮成功/失败未读，下一步验证 Host 的轻量摘要（轮号、原因、时间）和按轮匹配的已读写入；不要使用原生未读猜结果。不应把主动取消或普通 fork 的合成结束当作失败。

## 实机验收门槛

独立浏览器访问当前 GUI 时得到认证提示，未进入工作台。检测到浏览器提供 Notification API，不代表 Desktop Renderer 支持或系统通知已送达。未验证 Desktop/Web 端到端、多标签页协调、最小化通知及通知点击。

下一轮在已认证测试环境中，分别让 A 保留一个待授权、一个 legacy 提问、一个 timed 提问。B 不打开目标会话，分别测试晚加载、刷新/断线重连；A 处理请求后检查 B 的计数，以及 B 所示请求是否能在官方界面真正处理。Host 重启单列，不将历史审计记录误作可操作请求。断线、缺少权限或缺基线显示未知，不补发历史提醒。
