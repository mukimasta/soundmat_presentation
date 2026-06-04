# SoundMat 树莓派性能优化记录

## 背景
Pi 4 上 Jam mock 模式：50 颗石头 + 播放时 scsynth 99.9% / jam-loop ~90%，
JACK XRun 持续，音频卡到无法听。Mac 同场景无问题（CPU 余量 5–10×）。
目标：在 Pi 上 10–50 颗石头都能稳定演奏。

---

## 优化清单（按层次）

### A. 前端（mat.html）

| 改动 | 文件 | 收益 |
|------|------|------|
| **Pi mode 切换** | `web/static/mat.html` | 热力图 30fps → 10fps（保留数字）；LED 40fps → 20fps、关 SVG `feGaussianBlur` glow；按钮 + `localStorage` 持久化 |

> 在 Pi 本机用 Chromium 看 `/mat` 时启用，省 Chromium 上 ~50% GPU/CPU。
> 远程访问 / 不开 mat 页，影响 0。

---

### B. Jam 主循环（Python）

| 改动 | 文件 | 收益 |
|------|------|------|
| **LOOP_HZ 200 → 60** | `jam/app.py`、`jam/bridge/master_fx.py`（α 重算） | jam-loop CPU 直接降 ~60%；Lo-Fi 平滑系数同步调整以保持跟手感 |
| **`emit_sweep` 倒排** | `jam/event/event_engine.py` | 维护 `merged_sector → set[(ring, slc)]` 增量索引，每帧只对**有石头的**合并扇区中心做扫描弧跨越判断；O(N) → O(穿过的扇区数) |
| **LED markers 倒排** | `jam/led/renderer.py` | 一帧先把 markers 倒排成 `led_idx → [ring]`，每石头只影响 ±1 共 3 颗灯；O(108×N) → O(N) |

> 已用 micro-bench 验证：30 颗石单帧 1.0ms → 0.21ms（×4.6），50 颗 1.6ms → 0.27ms（×6.0）。
> emit_sweep 命中集合 + LED buffer 对旧实现**逐字节等价**（300 帧 × 5 个规模全过）。

---

### C. SuperCollider 端（音色等价）

| 改动 | 文件 | 收益 |
|------|------|------|
| **reverb send / 共享 reverb** | `sc/synthdefs/jam/reverb_bus.scd`（新增）+ `marimba.scd` 改 send | 原本每路 marimba 自带 reverb（4 CombC + 3 Allpass + 2 LPF ≈ 17 UGen），50 路 = 50 份；改为 1 份共享 reverb 总线。**单 voice CPU −45%**。听感等价（业界 send/return 标准做法） |
| **chord_pad 多频点合并** | `sc/synthdefs/jam/chord_pad.scd` 改成 `freq0..freq4` 5 通道；`SynthBridge.handle_chord` 一次发 1 个 synth | 原本一个和弦 5 个 SynthDef 实例（各自跑 envelope/LPF/vibrato），现在 1 个实例内部 `Mix.fill(5, ...)`；每和弦 SynthDef 实例 ×0.2 |
| **scsynth `-z` 参数化** | `core/sc_server.py` 加 `-z $SC_BLOCK_SIZE`；`config.SC_BLOCK_SIZE`（环境变量 `SOUNDMAT_BLOCK_SIZE`） | 留出 block size 调整入口（**默认仍 64**，原"对齐 JACK period 设 4096"的方案见 E 节已撤回） |

---

### D. 复音管理

| 改动 | 文件 | 收益 |
|------|------|------|
| **复音上限 + voice stealing** | `jam/bridge/synth_bridge.py` + `config.JAM_MAX_MELODIC_VOICES = 12` | 同时 alive 的 melody/bass voice 超 cap 时 free 最老 → scsynth 上限封顶。Pi 4 上 cap=12 把 50 颗时的 scsynth 从 99.9% → 87% |
| **per-instrument done_at 估算** | 同上 | 按各 SynthDef 真实 envelope 总长（marimba 固定 2.012s；rhodes/pad_pluck 等 = `sustain + release`）算 done_at，cap 触发时已自然 free 的 voice 不发 `/n_free`，消掉绝大部分 server warning |
| **Web 端可调** | `app.py.set_param("jam_max_melodic_voices")` + `mat.html` Calibration `Max voices` 输入 | 现场实时调；0 = 不限制 |

---

### E. Profile 驱动的二次优化（A–D 上线后基于 cProfile 的针对性收尾）

A–D 落定后用 cProfile 跑 jam-loop，发现：

```
ncalls    cumtime   percall   function
2444      4.679s    1.92ms    JamApp._tick
2444      3.082s    1.26ms    JamApp._render_led
2444      2.972s    1.22ms    JamLedRenderer.render
```

**`_render_led` 占整个 `_tick` 65.9%**；其中 96.4% 在 `JamLedRenderer.render` 的 108 次循环本体。`emit_sweep` / `SensorState.update` 完全没进 top 40（B 节倒排索引把这两条已经压扁）。结论：jam-loop 的剩余瓶颈不是事件层，是 LED 合成。

| 改动 | 文件 | 收益 |
|------|------|------|
| **LED 渲染 60Hz → 30Hz 节流** | `jam/app.py`（`LED_HZ = 30.0` + `_render_led` 入口 gate） | 物理灯带 30Hz 已远超人眼分辨；`on_scan_hit` / `on_preview` 仍每帧注入到列表，只跳过 108-LED 合成 + 串口写。**jam-loop 50 颗时 80% → 60%（实测）**。 |
| **撤回 `-z 4096`** | `config.py` 默认仍 64；`SETUP.md` 删除 Pi 设 4096 的推荐 | `-z` 同时是 `EnvGen.kr / Lag.kr / LFO` 的步长。`-z 4096` ≈ 93 ms kr 步长，鼓 attack（10–30 ms）会被打成 1–2 个采样点 → 阶梯化 / 含糊。CPU 节省其实就是 64 次内层 tick 的循环开销，DSP 总量不变；用音质换的"省"不划算。`-p` 与 `-z` **解耦**，`-p` 控延迟、`-z` 控 kr 精度。 |

> 结论：`SOUNDMAT_BLOCK_SIZE` 保持默认 64 不要改。CPU 紧张优先靠 D 节的 voice cap，
> 再考虑加大 `-p`。

---

## 性能对账（Pi 4 + JACK `-p2048`）

| 场景 | 改前（初始） | A–D 后 | A–E 后（当前） |
|------|--------------|--------|------------------|
| **空垫** | scsynth ~3% / jam-loop **86%** | scsynth ~3% / jam ~30% | — |
| **10 颗正常** | scsynth ~50% / jam ~60%（推测） | scsynth 52% / jam 54% | — |
| **50 颗极限** | scsynth **99.9%** / jam 82%，XRun 持续 | scsynth 87% / jam 80%，偶发 XRun | **scsynth 79% / jam-loop 60%**，XRun 进一步减少 |

> 50 颗实测（`top` 截屏）：`scsynth 79.1%` / 主线程 `soundmat 59.8%` + 副线程 `20.9%`（uvicorn / led-writer）。
> 从初始 99.9% / 90% 到 79% / 60%，scsynth 余 21% headroom、jam-loop 余 40%。
> XRun 状态：初始"一直刷"→ A–D 后"偶发"→ E 后"少见"。瞬时 spike 仍可能触发，
> 用户接受为"也算一种 lo-fi"。`/n_free Node not found` 极少量 warning，无功能影响。

---

## 可调参数

### 环境变量

| 变量 | 默认 | Pi 推荐 | 说明 |
|------|------|---------|------|
| `SOUNDMAT_SAMPLE_RATE` | `44100` | 44100 | scsynth `-S` |
| `SOUNDMAT_BLOCK_SIZE` | `64` | **`64`**（保持默认） | scsynth `-z`，控制 kr UGen 步长。**不要**为"对齐 JACK period"调大，会让鼓 attack 阶梯化（见 E 节）。 |

### Web 控制台（Mat 页 Calibration）

- `Max voices` — 复音上限（0 = 不限制；Pi 推荐 **12**，极密用 8–10）
- `Sector / LED offset`、`Threshold`、`Lo-Fi sum min/max`、`Control sum min` — 标定项
- 顶栏 `Pi mode` — 浏览器降帧（仅 Pi 本机用浏览器时开）

### JACK（Pi 部署）

`-p` 控延迟 + XRun 容忍度，`-z`（`SOUNDMAT_BLOCK_SIZE`）控 kr 精度，**两者解耦**：

```bash
jackd -P75 -t2000 -dalsa -dhw:Audio -r44100 -p2048 -n2
# SOUNDMAT_BLOCK_SIZE 保持默认 64，无需 export
```

`-p` 调参经验（@44.1 kHz）：

- `-p 1024`（23 ms 延迟）：装置感最好；50 颗石可能 XRun
- **`-p 2048`（46 ms）：当前推荐起步**，调度余量大、装置距离 1–2 m 听不出延迟
- `-p 4096`（93 ms）：仅在 2048 持续 XRun 时再加，敲石头到出声会有明显迟滞

CPU 紧张时的优先级（按收益顺序）：

1. 降 `Max voices`（Web Calibration，Pi 推荐 12，极密 8–10）
2. 关 Pi 本机 Chromium / `/mat` 页（远程访问不影响）
3. 加大 `-p` 到 4096（最后手段，会损失即时感）
