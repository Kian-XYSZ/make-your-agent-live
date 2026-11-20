# 02 · 选 ASR：让她听懂

> TTS 决定"她像不像她"，ASR 决定"她能不能听懂"。
> 前者影响体验，后者影响**能不能用**。

---

## 四个引擎

| 引擎 | 成本 | 限制 | 适合 |
|---|---|---|---|
| **MiniMax** `asr-1.0` | 有 M Plan 就含 | 上传 ≤50 MB | **默认第一顺位** |
| **DeepSeek** | 0.39 元/小时 | ≤8 MB，≤120 秒 | 想统一 billing |
| **MiMo** `mimo-v2.5-asr` | **按量付费（不是免费）** | ≤10 MB | 备用 |
| **本地** whisper / SenseVoice | 永久免费 | 看机器 | 不联网、隐私优先 |

> ⚠️ **云端 ASR 没有免费档。** 小米（MiMo）只有 **TTS** 是限时免费，
> 语音识别是照常计费的。别把两者混在一起说。
> 想要零成本只有一条路：本地跑 whisper / SenseVoice。

配多个会自动降级——**一个 key 过期不会让她突然聋掉**。

---

## 实测：谁更准

用同一批音频（6 句中文）跑两个引擎，算字符错误率（CER）：

| 引擎 | 平均 CER |
|---|---|
| MiMo | 7.9% |
| MiniMax | 8.6% |

**基本打平。** 两个 20%+ 的错误是同一个（合成语音本身不够清晰），不是引擎的锅。

抗噪测试更值得看：拿一段**带背景音乐**的音频，和去掉 BGM 的同一段音频分别识别——

```
带 BGM：  你神经病啊，以后不要问这么傻逼的问题……
去 BGM：  你神经病啊，以后不要问这么傻逼的问题……
```

**结果一字不差。** 说明这几个引擎对背景音乐都不敏感，真实场景够用。

> 选 MiniMax 的真正理由是**你已经付费了**（M Plan 含 ASR），边际成本为零。
> 不是因为更准。

---

## API 差异（写代码才会踩）

三个引擎的调用形态**不一样**：

### MiniMax —— multipart 表单

```
POST {base}/speech_to_text
Authorization: Bearer <key>
Content-Type: multipart/form-data

model=asr-1.0 & file=<音频> & language=zh 可选
→ { "text": "...", "duration": 3.84 }
```

### DeepSeek —— multipart 表单

```
POST {base}/tools/asr
Authorization: Bearer <key>

file=<音频>
→ { "text": "...", "duration_ms": 3200 }
```

### MiMo —— OpenAI 兼容的 chat/completions

```
POST {base}/chat/completions
api-key: <key>

{
  "model": "mimo-v2.5-asr",
  "messages": [{
    "role": "user",
    "content": [{ "type": "input_audio", "input_audio": { "data": "data:audio/wav;base64,..." } }]
  }],
  "asr_options": { "language": "zh" }
}
→ choices[0].message.content
```

> MiMo 走的是**聊天接口**，不是专门的音频接口。音频要包成 data URL。

---

## 三个坑

### ① 输出变方块字（最坑的一个）

Windows 上 Python 默认用 **GBK** 写 stdout，而 Node 按 **UTF-8** 读——中文全变成替换符。

```
修复前字节：c1c1b8e7...   ← GBK 的"亮哥"
按 UTF-8 解：����          ← 一堆方块
修复后字节：e4baaee5...   ← UTF-8
按 UTF-8 解：亮哥
```

**修复**：脚本内强制 UTF-8，别指望环境变量。

```python
for s in (sys.stdout, sys.stderr):
    s.reconfigure(encoding="utf-8", errors="replace")
```

Node 侧再补一层保险：spawn 子进程时传 `PYTHONIOENCODING=utf-8`。

> 本项目的 Node 实现没有这个问题（Node 字符串天然 UTF-8），
> 但你自己写 Python 桥接时一定会遇到。

### ② 格式和大小限制各不相同

| 引擎 | 格式 | 大小 | 时长 |
|---|---|---|---|
| MiniMax | 不限 | ≤50 MB | ≤500 秒 |
| DeepSeek | **仅 wav / ogg opus** | ≤8 MB | ≤120 秒 |
| MiMo | **仅 wav / mp3** | ≤10 MB | — |

QQ 语音都很短，时长不是问题；**格式**才是。
如果你是拿 mp3 来的，DeepSeek 会直接拒绝——降级链会自动换下一个。

### ③ 采样率其实不用管

不依赖高采样率，转成 **单声道 16 kHz** 就行，识别结果不受影响，体积还小很多：

```bash
ffmpeg -i in.mp3 -ac 1 -ar 16000 out.wav
```

---

## 本地方案（不想联网）

| 方案 | 模型大小 | 中文准确率 | 速度 |
|---|---|---|---|
| **SenseVoice-Small** | ~500 MB | **CER 7.81%** | CPU 上 17 倍实时 |
| whisper-large-v3 | ~3 GB | CER 20% | 慢 |
| Paraformer | ~1 GB | CER 10% | 快 |

**SenseVoice 明显更划算**：中文错误率只有 Whisper 的三分之一，CPU 就能跑，不占显卡。

而且它**同一个模型能输出情绪**（高兴/悲伤/愤怒/中性/恐惧/厌恶/惊讶）和声音事件（笑声/掌声/音乐）。

对陪伴型 agent 来说这条很有用：

> 你说"我没事"——字面是没事，但她能听出声音是疲惫还是烦躁，回复完全不同。

接法：跑个本地服务，把地址填进 `LOCAL_ASR_ENDPOINT`：

```bash
LOCAL_ASR_ENDPOINT=http://127.0.0.1:9881/transcribe
```

服务只需要满足：

```
POST /transcribe   multipart，字段名 file
→ { "text": "..." }
```

---

## 配置

```json
// myal.config.json
{
  "asr": {
    "provider": "auto",     // auto | minimax | deepseek | mimo | local
    "language": "zh"
  }
}
```

`auto` 的降级顺序：`minimax → deepseek → mimo → local`

想强制用某个：`myal asr x.wav --provider deepseek`
