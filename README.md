# make-your-agent-live

> **让你的 agent 像人一样，在 QQ 里主动跟你说话。**

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

不是"打开网页去调用"的工具，而是**手机里那个会冒出来找你说话的存在**：

- 有**自己的声音**（一段录音克隆，或一句话描述生成，独一无二）
- **听得懂你发的语音**（不用打字）
- 会**主动找你**（定时提醒、不定时闲聊）
- 在 **QQ** 里，你最常用的那个聊天窗口

你可以把它当**有声音特色的 AI 助理**，也可以当**一只会说话的 AI 宠物**——取决于你给它什么人设。

不绑定任何框架：DSH、Claude Code、Cursor、Codex、一个 shell 脚本——都能用。

```bash
npx make-your-agent-live tts "你好，我是她" -o hi.wav    # 说话
npx make-your-agent-live asr hi.wav                      # 听话
npx make-your-agent-live qq send --record hi.wav --to 123456
```

---

## ⚠️ 风险提示（动手前必读）

QQ 这一层走的是**个人号 + 第三方协议端**（SnowLuma / NapCat / Lagrange 这类）。
**腾讯的用户协议不允许这种用法，存在封号风险。**

| 事项 | 说明 |
|---|---|
| 🚫 **必须用小号** | 别拿主号试。新注册一个，被封的代价才小 |
| 🚫 **不推荐商用** | 商用风险自负，本项目不给任何担保 |
| ⚠️ **协议端会失效** | 今天能用不代表明天能用（NapCat 已经停更了） |
| ✅ **自用可以** | 自己玩、自己测试，风险自担 |

本项目只提供**技术方案**，不鼓励也不支持违反平台协议的使用。
如果只是想让 agent 有声音、能听语音，**完全不接 QQ 也能用**（CLI 和库都行）。

---

## 它解决什么问题

| 问题 | 别人的做法 | 这里怎么做 |
|---|---|---|
| AI 只有文字，没有"存在感" | 接个 TTS，用系统默认音色 | **克隆一段你喜欢的音色**，永远固定 |
| 每个 AI 的声音都一样 | 用平台预设 | 一段 15 秒样本 → 独一无二 |
| 想让它主动找你 | 得自己写定时任务 | 内置机制 + 提示词模板，连频率都帮你控 |
| QQ 语音听不了 | 放弃 | SILK → 协议端 → ASR → 文字 |
| 换 TTS 供应商要重写 | 绑死一家 | provider 可切换 + **自动降级** |

## 三个能力

### 1. TTS：给她一个只属于她的声音

```bash
myal tts "亮哥，该学习了" --voice ./voice/her.wav -o out.wav
```

- **克隆**：一段 15 秒录音 → 永远同一个嗓子
- **设计**：一句文字描述 → 凭空造一个音色（没有样本时用）
- **内置**：9 个现成音色（图省事）

> 默认走小米 MiMo，**限时免费**，克隆和音色设计都免费。
> 详见 [docs/03-TTS.md](./docs/03-TTS.md)

### 2. ASR：让她听懂

```bash
myal asr voice.wav
```

四个引擎，**自动降级**，一个挂了不会聋：

| 引擎 | 成本 |
|---|---|
| MiniMax | 有 M Plan 就含（默认第一顺位） |
| DeepSeek | 0.39 元/小时 |
| MiMo | 限时免费 |
| 本地 | 免费（whisper / SenseVoice） |

> 详见 [docs/02-ASR.md](./docs/02-ASR.md)

### 3. QQ：把它接进聊天

```bash
myal qq send --record out.wav --to 123456     # 发语音
myal qq send --image chart.png --to 123456    # 发图片
myal qq status                                # 查连接
```

支持任何 OneBot 11 协议端（SnowLuma / NapCat / Lagrange）。
**QQ 语音是 SILK 编码，ffmpeg 都不认**——所以必须用协议端，这是硬约束。

> 详见 [docs/01-QQ.md](./docs/01-QQ.md)

---

## 给 Agent 用（重点）

如果你是 AI agent，**先读 [AGENTS.md](./AGENTS.md)**。

那份文档写了：问用户什么、怎么配、怎么验证、卡住怎么办、以及 5 条铁律（比如**绝不索要密码**）。

三句话概括：

1. 先让她**能出声**（最容易验证，10 分钟）
2. 再让她**能听话**（5 分钟）
3. 最后才**接 QQ**（20 分钟，会卡在扫码，别一上来就做）

---

## 安装

### npm（最省事，国内走 npmmirror 镜像，不用翻墙）

```bash
# 命令行
npm i -g make-your-agent-live
myal doctor

# DSH 插件（装完多出 tts / asr 两个工具）
dsh plugin --profile desktop add make-your-agent-live
```

或者不装，直接跑：

```bash
npx make-your-agent-live doctor
```

### 国内 Git 方式（npm 用不了时）

```bash
# DSH 插件方式 —— 从 Gitee 镜像装
dsh plugin --profile desktop add git+https://gitee.com/kunliang-zhang/make-your-agent-live.git

# 或者直接 clone
git clone https://gitee.com/kunliang-zhang/make-your-agent-live.git
cd make-your-agent-live && node cli/index.js doctor
```

### 海外 / 有代理

```bash
dsh plugin --profile desktop add github:Kian-XYSZ/make-your-agent-live
# 或者
git clone https://github.com/Kian-XYSZ/make-your-agent-live.git
cd make-your-agent-live && node cli/index.js doctor
```

`myal doctor` 会告诉你还缺什么：

```
✔ Node 22.22.3
✔ 平台 win32  — 系统语音可用（SAPI）
✔ ffmpeg      — 缺了只是不能变速
✔ TTS 可用 provider  — mimo → minimax
✔ ASR 可用 provider  — minimax → mimo
! 音色样本    — 没设 tts.voiceFile，会退化到内置音色
```

> **三个分发渠道**：GitHub 是主仓库（issue / star / PR），Gitee 是国内镜像，
> npm 是安装通道。内容一致。

---

## 配置

三种方式，优先级从低到高：

| 位置 | 用途 |
|---|---|
| `~/.dsh/.credentials.yaml` | DSH 用户已经有这个文件了，直接复用 |
| `./.env` | 单项目配置 |
| 环境变量 | CI / 临时覆盖 |
| `./myal.config.json` | 结构化配置（provider 选择等） |

最小配置（`.env`）：

```bash
XIAOMI_API_KEY=sk-...        # TTS + ASR 备用
MINIMAX_API_KEY=sk-...       # ASR 主力
```

**一个 key 都没有也能跑**——Windows/macOS 会自动降级到系统语音。

---

## 作为库用

```js
import { speak, transcribe, OneBot } from 'make-your-agent-live';

const { data, format } = await speak('你好', { tempo: 1.2 });
const { text } = await transcribe('/tmp/x.wav');

const bot = new OneBot({ httpUrl: 'http://127.0.0.1:3000', accessToken: '...' });
await bot.sendRecord({ userId: '123456' }, '/tmp/x.wav');
```

---

## 在 DSH 里作为插件

```bash
dsh plugin --profile desktop add github:Kian-XYSZ/make-your-agent-live
```

装完会多两个工具：`tts` 和 `asr`。

> 生成的音频默认写进 **QQ 网关的 outbox 目录**（如果存在），
> 这样 `qq_send` 的 `record` 段可以直接发，不用手动拷。

---

## 目录

```
AGENTS.md              ★ 给 agent 的安装协议（先读这个）
README.md              你正在看的
docs/
  01-QQ.md             协议端从零到连上
  02-ASR.md            四个引擎怎么选
  03-TTS.md            音色克隆完整流程（含踩坑）
  04-定时主动消息.md    让她主动找你
personas/example.md    人格卡模板（脱敏）
src/                   核心实现，框架无关
cli/                   myal 命令行
adapters/dsh/          DSH 插件适配器
tools/                 开发用的小工具
```

---

## 已知限制

- **QQ 语音必须走协议端**，没有别的路。个人号被风控的风险自己承担。
- **收语音需要宿主支持**。本项目提供 ASR 工具，但"收到语音自动转写"取决于你的宿主（DSH 用 qq-gateway 插件 + 一个补丁）。
- **克隆音色有法律边界**。用别人的声音做公开内容涉及声音权（中国《民法典》1023 条）。**仓库里不放任何音色样本**，只用你自己的。
- 系统语音（SAPI / say）音质很机械，只当兜底。

---

## License

MIT。见 [LICENSE](./LICENSE)。
