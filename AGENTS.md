# 插件发布规则

- npm 发布使用 Git tag `<插件标识>-v<主版本>.<次版本>.<修订版本>`，例如 `dsh-chat-groups-v0.1.3`。插件标识使用小写字母、数字和连字符，并与 [发布清单](.github/npm-plugins.json) 中的键一致。
- 在准备发布的提交里先更新插件 `package.json` 的 `version`。Git tag 中的版本必须与该提交里的版本完全一致。每个 tag 只发布一个插件。
- 将对应 tag 推送到 GitHub 会触发 [共享发布工作流](.github/workflows/publish-npm.yml)。工作流先校验版本和包名，再测试、打包并发布到清单指定的 npm dist-tag。`dsh-chat-groups` 使用 `latest`。
- 只有在用户明确要求发布时，才创建并推送发布 tag。已发布的 tag 和 npm 版本均不可复用，修复后应增加版本号并使用新 tag。
- 新增插件时，将插件标识、目录、npm 包名和 dist-tag 加入发布清单。在插件的 `package.json` 声明 GitHub 仓库 URL，并为对应 npm 包配置 GitHub Actions Trusted Publisher。仓库填 `jiangliuhong/dsh-plugins`，工作流文件名填 `publish-npm.yml`，启用 `Allow npm publish`。
