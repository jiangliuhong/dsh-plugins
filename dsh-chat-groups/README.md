# dsh-chat-groups

在 DeepSeek Harness（DSH）的侧栏中按任务整理会话：可创建分组、把会话加入／移动分组、在分组内新建会话。分组数据由 Host 保存，停用插件后恢复原生侧栏且数据保留。

会话归属取决于创建入口，两种侧栏视图的行为一致。

- 在消息上点击「在新对话中分支」，新会话继承来源会话当前的分组。来源未分组时，新会话也未分组。之后可以分别移动两个会话。
- 在工作区点击「新建会话」，会打开未分组的空会话；分组中的空会话和草稿会保留在原处。
- 在分组上点击「新建会话」，新会话直接加入该分组。

## 安装

### Web

在仓库根目录或插件目录运行：

```sh
dsh plugin --profile web add "$(git rev-parse --show-toplevel)/dsh-chat-groups"
dsh web
```

### Desktop

在 DSH 的「插件」页面点「添加插件」：

- 输入插件包名 `dsh-chat-groups` 或 GitHub 仓库地址 `https://github.com/jiangliuhong/dsh-plugins` 进行安装；
- 或选择本地 `dsh-chat-groups` 目录进行安装。

启动后在侧栏工作区工具栏点「切换到会话分组视图」即可使用；点「返回默认视图」回到原生列表。要停用，在 DSH「插件」页面关闭 `dsh-chat-groups`。
