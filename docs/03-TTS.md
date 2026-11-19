# 03 · 选 TTS：给她一个只属于她的声音

> 这一章讲这个项目最重要的一件事：**让 Agent 拥有"自己的"声音**，
> 而不是一个谁都在用的默认音色。

---

## 主路径：克隆

**做法**：找一段你喜欢的说话声音 → 截 15 秒 → 存成 `her-voice.wav` → 每句话都拿它克隆。

```
一段 15 秒干净人声  →  her-voice.wav  →  每次合成都用它
        ↑                                      ↓
   你自己录 / 从视频里扒                    永远同一个嗓子
```

**为什么必须克隆、不能每次重新生成？**

因为生成是随机的。同一段描述跑四次，鼻音、尾音、语速全都不一样——今天听着像她，明天就不像了。

**克隆是确定性的**：同一个样本，永远同一个音色（只有情绪有轻微波动）。

---

## API

三个 TTS 模型共用一个端点（OpenAI 兼容），靠 `model` 区分：

```js
POST https://api.xiaomimimo.com/v1/chat/completions
headers: { 'api-key': key, 'Content-Type': 'application/json' }

{
  "model": "mimo-v2.5-tts-voiceclone",
  "messages": [
    { "role": "user",      "content": "" },               // 朗读风格，留空最忠实
    { "role": "assistant", "content": "亮哥，该学习了。" }  // 要说的文本
  ],
  "audio": {
    "format": "wav",
    "voice": "data:audio/wav;base64,<her-voice.wav 的 base64>"
  },
  "stream": false
}
```

音频在响应里：`choices[0].message.audio.data`（base64）。

### 三种模型的分工

| 模型 | 音色从哪来 | `messages[0].content` 放什么 | `audio.voice` 放什么 |
|---|---|---|---|
| `mimo-v2.5-tts-voiceclone` | **一段录音** | 朗读风格（建议留空） | `data:audio/...;base64,...` |
| `mimo-v2.5-tts-voicedesign` | 一段文字描述 | **音色描述** | 不填 |
| `mimo-v2.5-tts` | 内置 9 个音色 | 朗读风格 | 音色名，如 `冰糖` |

> ⚠️ `voicedesign` 的 user 消息是**音色**不是风格。写成"温柔一点"，出来的人声会莫名其妙。

---

## 样本从哪来

| 来源 | 注意 |
|---|---|
| 自己录 | 最省事，安静环境、离麦近、不带口音就行 |
| 视频里扒 | **必须去 BGM**，见下 |

**样本要求**：5–30 秒（15 秒最优）、单人、干净、没有背景音乐、情绪接近你想要的。

### 从视频扒的话，一定要分离 BGM

扒来的音频几乎都混着音乐。直接克隆，BGM 会被学成"音色"的一部分，人声特征（尤其**鼻音**）会被稀释。

```bash
uv run --with demucs python -m demucs --two-stems=vocals \
  -n htdemucs --out ./sep input.wav
# 人声在 ./sep/htdemucs/<名字>/vocals.wav
```

> 实测：分离前克隆出来"差一点"，分离后当场对了。这一步不能省。

---

## 三条实测经验

### ① 想调语速，别给风格指令

```js
// ❌ 音色会漂：模型连发声方式一起改了
{ role: 'user', content: '语速快一点' }

// ✅ 音色不变：生成后做纯音频变速
ffmpeg -i in.wav -filter:a atempo=1.2 out.wav
```

`atempo` 只拉伸时间轴，不动音高和音色。**1.5 倍以上开始有机械感**。

### ② `voice` 必须是 data URL

```
✅ data:audio/wav;base64,Uk1GRg...
❌ /home/user/her-voice.wav
❌ file:///home/user/her-voice.wav
```

样本限制：≤10 MB，只收 `wav` / `mp3`。

### ③ 换声音不用重装

`her-voice.wav` 就是一个文件。想换音色，换掉这个文件就行——**代码、配置、人格都不用动**。

---

## 备选一：从零设计一个音色

如果你**没有**现成录音，想凭空造一个世界上不存在的声音：

```
voicedesign 抽卡（用文字描述，跑 5–10 个候选）
      ↓
挑一个喜欢的
      ↓
存成 her-voice.wav
      ↓
之后全部走 voiceclone 固定
```

这段流程只是「怎么弄到 her-voice.wav」的一种方式——**之后的主线仍然是克隆**。

描述写法参考（越像给演员说戏越好）：

```text
✅ 二十三岁中文女声，声音清亮微甜，语速偏慢，句尾轻轻上扬，像在跟熟人说话。
✅ 刚睡醒的少女，声音软塌塌的，还在打哈欠，说话没什么力气，尾音往下掉。
✅ 窝在被窝里的女孩，声音又软又黏，尾音拖得很长。

❌ 好听的女声      ❌ 温柔的声音      ❌ 有感情一点
```

可用维度：年龄性别 / 音色（清亮·软糯·偏奶·微哑）/ 语速 / 音量气息 / 尾音（上扬·下坠·拖长）/ 场景状态（刚睡醒·夜里低声）/ 鼻音。

---

## 备选二：用内置音色（图省事）

9 个现成的，不用准备样本：`mimo_default` `冰糖` `茉莉` `苏打` `白桦` `Mia` `Chloe` `Milo` `Dean`

---

## 成本

**MiMo TTS 三个模型目前官方标为「限时免费」**（和它的 ASR 共用一个 key）。

免费期结束后按平台账单计费。项目做成可切换 provider，就是为了那时能平滑切走。

---

## 其他方案

| 方案 | 音色 | 成本 | 适合 |
|---|---|---|---|
| **MiMo 克隆** | 录音克隆 | 限时免费 | **默认** |
| MiniMax | 预设 + 快速克隆 | 有会员就含 | 已有 MiniMax 会员 |
| 本地 Qwen3-TTS | 克隆 / 设计 | 免费 | 不联网、显存 ≥2 GB |
| 系统语音（Windows SAPI） | 固定几个 | 免费 | **兜底**：什么 key 都没有也能出声 |

> 本地 Qwen3-TTS 要跑 14 个导出脚本（官方模型 → GGUF + ONNX），约 1–2 小时、10 GB。
> 项目只写调用约定，不代跑导出。

---

## 配置

```yaml
tts:
  provider: mimo                  # mimo | minimax | local | system

  mimo:
    apiKey: ${XIAOMI_API_KEY}     # 也读 ~/.dsh/.credentials.yaml
    voiceFile: ./voice/her.wav    # ★ 克隆样本，主线
    design: ""                    # 只在没有 voiceFile 时才用（voicedesign 抽卡）
    tempo: 1.0                    # 1.0–1.5，纯音频变速

  minimax:
    apiKey: ${MINIMAX_API_KEY}
    voiceId: ...

  local:
    endpoint: http://127.0.0.1:9880   # 任何兼容的本地 TTS 服务

  system:
    voice: Microsoft Huihui Desktop   # Windows SAPI 音色名
```

**降级顺序**：`配置的 provider` → `MiMo` → `系统语音`

任何一步失败都往下掉，**保证永远有声音**，不会因为 key 过期就哑了。
