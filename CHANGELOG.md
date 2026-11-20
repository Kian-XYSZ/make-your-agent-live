# 变更记录

## 0.2.5

- 修 `bin` 路径写法（`./cli/index.js` → `cli/index.js`），消除 npm 的 auto-correct 警告
- 加这份 CHANGELOG

## 0.2.4

- `START.md` 改成**纯给 agent 的执行指令**：删掉所有面向人类的内容，
  只保留「问什么 / 怎么做 / 怎么验收 / 哪些话必须照读」
- 理由：用户不会自己看文档，只会说「帮我装」

## 0.2.3

- 给不懂 AI 的人讲清楚：**"说话"免费、"听话"收费、每个云端服务都要自己注册**
- 三个词的大白话解释（API Key / 云端 / 本地）
- README 加「要注册什么，要花多少钱」表

## 0.2.2

- 补上**推荐组合**：TTS 用小米 MiMo（限免），ASR 用 MiniMax（已付费）
- 之前只有选项表、没有默认答案

## 0.2.1

- 更正成本说明：**小米只有 TTS 限免，ASR 是按量付费**
- 云端 ASR 没有免费档，唯一零成本方案是本地 whisper / SenseVoice

## 0.2.0

- 加 `START.md`：一页纸的 agent 启动指令
- 加 `myal init`：打印该发给 agent 的那句话，顺带体检环境

## 0.1.4

- 重新定位：**像人一样在 QQ 里主动交互的 AI 助理 / 宠物**
- QQ 封号风险提示提到 README 最前面
- `AGENTS.md` 要求 agent 接 QQ 前必须先告知风险（铁律⑤）

## 0.1.2

- 修复 `package.json` 带 UTF-8 BOM 导致宿主拒绝安装（`JSON.parse` 报 Unexpected token）
- 加 `scripts/check-files.mjs` + `prepublishOnly` 钩子，防止复发

## 0.1.0

- 首次发布：TTS（4 provider + 降级）、ASR（4 provider + 降级）、OneBot 11 桥
