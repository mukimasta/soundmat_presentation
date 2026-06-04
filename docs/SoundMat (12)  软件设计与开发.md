# SoundMat 软件设计与开发

本文档描述 SoundMat 上位机的软件层设计与开发方案。硬件、电子系统、传感器原理、ESP32 固件等部分见对应的设计文档；本文档假设硬件已经通过串口提供传感数据帧，专注于树莓派上运行的 Python 程序与 SuperCollider 音频引擎的设计。

---

## 1. 运行平台

SoundMat 上位机运行在 **Raspberry Pi 3B V1.2** 上，使用 **Raspberry Pi OS Lite**（无桌面环境的精简版本）。选择这个组合的考量是：

- **性能足够**。Pi 3B 的 ARM Cortex-A53 四核 1.2 GHz CPU 加上 1 GB RAM，足以同时运行 Python 音乐逻辑层和 SuperCollider 音频合成进程。
- **接口齐全**。4 个 USB-A 口分别接 ESP32（串口）、USB DAC（音频输出）、调试 U 盘；以太网/WiFi 用于开发期 SSH 和 Web 控制台访问。
- **体积小、功耗低**。可以塞进装置空腔内，详见电子系统设计文档。
- **软件生态成熟**。Linux + Python + SuperCollider 是已经验证的实时音频组合。

Raspberry Pi OS Lite 比标准版省下大量后台资源，留给音频处理。运行时不需要图形界面——所有人机交互通过 SSH 或 Web 控制台完成。

**开发机**：macOS 上同样可运行（`uv run soundmat`），scsynth 路径由 `SOUNDMAT_SCSYNTH` 覆盖；串口在 Mac 上为 `/dev/cu.usbserial-*`。部署目标仍是 Pi + USB DAC。

---

## 2. 系统总览

整个 SoundMat 软件系统的数据流如下：

```
                                                    +-----------+
   +-------+   serial    +-----------+    OSC       |  scsynth  |
   | ESP32 |  ---------> |    Pi     |  ----------> |    (SC)   | 
   |       |   S 帧       |  Python   |             |           |
   |       |  <--------- |           |        +-----+-----------+
   +-------+   serial    +-----------+        +-> USB DAC --> 音响
       ↓        L 帧
   LED 灯带
```

具体步骤：

1. **传感数据接收**。树莓派通过 USB 串口持续接收 ESP32 发送的 S 帧（每帧 256 个 12-bit ADC 值，约 20-30 fps）。
    
2. **数据解析**。Python 程序将原始 ADC 矩阵解析为"哪些 (ring, slice) 位置上有物体"的状态快照，并进一步识别出"放下 / 拿起"等交互事件。
    
3. **音乐逻辑**。根据传感器状态和交互事件，音乐逻辑层决定要触发什么音、调整什么参数。这一层不直接发声,只产生抽象的音乐事件。
    
4. **音频合成**。音乐事件被翻译成 OSC 消息发送给 SuperCollider 的 scsynth 进程,scsynth 实例化 SynthDef、合成音频或回放样本,通过 USB DAC 输出到外部音响。
    
5. **LED 反向链路**。Python 程序同时根据当前状态计算 LED 灯带的颜色 buffer,编码成 L 帧通过同一条串口发回 ESP32,由 ESP32 驱动 WS2812B 灯带。
    

---

## 3. 音频引擎:SuperCollider

SoundMat 的音频引擎选用 **SuperCollider**(以下简称 SC)。SC 是一个开源的实时音频合成与算法作曲平台,最早由 James McCartney 在 1996 年发布。它由两个独立程序组成:

- **scsynth**:音频合成服务器。接受 OSC 消息,实时合成音频。性能极好,可以同时跑几百个 voice。
- **sclang**:SuperCollider 语言解释器。SC 自己的 DSL,用来定义 SynthDef、编写音乐逻辑、向 scsynth 发 OSC 消息。

选择 SC 的理由:

- **实时性能强**。scsynth 是为低延迟实时音频专门设计的,CPU 占用低。
- **样本和合成都强**。既能流式播放长样本(Ambient 模式需要),也能做复杂合成器(Jam 模式需要)。
- **OSC 原生**。scsynth 通过 OSC 控制,天然适合由其他语言驱动。
- **跨平台**。Linux ARM 上有良好支持,可以在 Pi 上无 GUI 运行。

---

## 4. 音频引擎软件架构

### 架构设计思路

逻辑是 Python 的强项,音频是 SuperCollider 的强项。**能放在 Python 的逻辑就不要放在 SuperCollider**。但这不意味着 Python 要全方位地操控 SuperCollider——而是要在 SuperCollider 端做好合适的抽象,暴露出合适的接口,让 Python 拿到的是"声音积木"而不是底层音频细节。

### Python 与 SC 的对接方案对比

Python 与 SC 通信有几种主流方案:

|方案|说明|评价|
|---|---|---|
|**手写 OSC**|Python 用 `python-osc` 直接发 `/s_new`、`/n_set` 等消息|灵活但啰嗦,所有节点 ID、参数管理都要自己来|
|**subprocess + sclang**|Python 启动 sclang 子进程,通过文本接口下指令|间接、慢、容错难|
|**Python supercollider 库**|Python 直接通过库 API 控制 scsynth,库内部封装 OSC|抽象层级合适,可读性好|

我们选用第三种:**python 的 supercollider 库**。它在 Python 层提供了对 scsynth 节点、SynthDef、Buffer 等概念的封装,既比手写 OSC 高级,又比起 sclang 子进程方案更直接。

### sclang 与 scsynth 的关系

SC 实际上由两个独立程序组成:

- **sclang**:解释器。运行 SC 语言代码。
- **scsynth**:服务器。真正合成音频的实时进程。

正常使用 SC 时,sclang 把音乐逻辑翻译成 OSC 消息发给 scsynth,scsynth 收到消息后实例化 Synth 节点合成声音。两者之间通过 OSC 通信——这也是为什么我们可以绕开 sclang 直接用 Python 控制 scsynth。

### 我们的实际架构

```
[ 过去:纯 SuperCollider ]
音乐逻辑 (sclang) ──> 实例化 SC 自身的 Synth 类 ──> 指挥 scsynth 节点
                                ▼
                      [sclang 定义的 SynthDef]


[ 现在:Python + supercollider 库 + SC ]
音乐逻辑 (python) ──> 实例化 python 库的 Synth 类 ──> 指挥 scsynth 节点
                                ▼                          ▼
                    [Python 库中的同名傀儡类]    [提前编译的 SynthDef]
                                                           ▼
                                              [sclang 定义的 SynthDef]
```

简单说:

- **SC 端**:仍然用 sclang 写 SynthDef,但是把它们**提前编译成 `.scsyndef` 文件**就完事,不需要 sclang 运行时介入。
- **Python 端**:通过 supercollider 库实例化 Synth、控制参数、起停节点;库内部负责把这些操作翻译成 OSC 发给 scsynth。
- **scsynth**:作为独立服务进程,加载所有 `.scsyndef`,等 Python 发指令。

这样的好处:**所有音乐逻辑都是 Python**,可以用 Python 完整的生态(数据结构、yaml/toml 加载、HTTP 服务、Web 框架);**所有发声都是 scsynth**,性能稳定。两边的边界清晰——**Python 写"什么时候响什么",SC 写"响起来是什么样的"**。

我们只需要将声音素材写成 SynthDef、编译成 `.scsyndef` 文件,之后使用 Python 写逻辑、控制音乐即可。

---

## 5. 详细软件架构

### 5.1 整体设计思路

SoundMat 支持两种播放模式:

- **Ambient 模式**:公共艺术装置场景的氛围环境音乐(如《京都岚山》主题)
- **Jam 模式**:节拍驱动的 Lo-Fi 循环音乐

两个模式表面看起来差异很大,但它们共用同一套硬件(Pi、ESP32、USB DAC、LED 灯带)和同一个 SC 服务器。架构设计要在"两个模式各自做最自然的事"和"共享资源不重复"之间找平衡。

实际上**两个模式真正共享的只有硬件 I/O 和 SC 服务器**,它们的音乐逻辑没有共同点。所以我们不强行抽象出统一的"音乐引擎",而是把两个模式当成两个独立的应用,跑在同一套底层服务上。共享部分集中在 `core/` 模块里,模式自己的逻辑分别在 `ambient/` 和 `jam/` 里独立发展。

主程序根据 manifest 文件选择启动哪个模式。运行时只有一个模式 active,模式切换通过 Web 控制台触发,无需重启程序。

### 5.2 Ambient 模式核心思路

Ambient 模式用于公共艺术装置:用户在圆形垫面上放石头,系统实时生成氛围音乐。主循环约 20 Hz。

**核心数据流**:

```
sensor → tracker → state → mapper → voices → engine → scsynth
```

一句话:**sensor 读出垫上有哪些石头 → state 算出本帧变化 → mapper 决定该响什么 → voices 做帧间 diff 并执行 → engine 通过 OSC 驱动 scsynth**。

**混合交互模型**。Ambient 模式中,声音分两类,采用不同处理方式:

- **持续类声音**(风、溪流、pad 等)用**状态调和**(reconcile):mapper 每帧给出"应该播什么"的期望集合,voices 引擎做帧间 diff,决定要起 / 停哪些 voice,自动跟随状态变化。
- **触发类声音**(钟、事件音等)用**事件驱动**:只在物体放下 / 拿起的边沿事件时一次性触发。

**逻辑与音频严格分离**:

- `mapping.py` 是纯函数式的"音乐大脑",只产生"该播什么"的声明,不发任何 OSC。
- `voices.py` 是 reconcile 引擎,负责将声明同步到实际的 scsynth 节点状态。

样本按 Ring 组织(低音、中频、竹林、天气、旋律、事件等),通过 manifest(如 `kyoto.toml`)声明式装配。SynthDef 离线编译成 `.scsyndef`,运行时只加载编译产物。FX 链固定:`sources → reverb → master`。

模块为**扁平文件**（非子包目录）：`tracker.py`、`state.py`、`mapping.py`、`voices.py`、`buffers.py`、`led.py`。

### 5.3 Jam 模式核心思路

Jam 模式的核心原则一句话:**把"音乐内容(What)"和"音乐执行(How)"彻底分离**。所有可替换的东西都做成声明式配置数据,代码只负责通用调度和解释。配置改了换首曲子,代码一行不动。

整个 Jam 模式分五层:

```
配置层 → 音乐理论层 → 调度层 → 事件层 → 桥层 → SC
```

- **配置层**:纯数据。BPM、key、scale、和弦进行、旋律表、鼓 pattern、ring 配置、lofi 映射曲线等,全部以 YAML/TOML 形式存在。
- **音乐理论层**:静态服务。`DegreeParser` 解析数字记谱("1#^"),`Tonality` 把级数翻译成 MIDI,`Tempo` 把 BPM 转成时间常数。
- **调度层**:节拍器。`Transport`(启停 + 主时钟)、`ScanLine`(连续角度扫描 + loop_rotation)、`SongPositionTracker`(当前 chord、bar)。
- **事件层**:核心音乐逻辑。三个 engine 并行:`HarmonyEngine`(和声 pad 按时间区间触发)、`DrumEngine`(鼓按 16 分 tick)、`EventEngine`(旋律/bass,扫描线扫过石头触发 + 放石 preview)。`SensorState` 负责 wire→逻辑坐标、occupied/placed/removed、R0/R1 Lo-Fi 与控制石 active 判定。
- **桥层**:把 NoteEvent 翻译成 OSC,在此处应用 ring → instrument 映射,把级数解析成 MIDI。

**关键可调点**:

- **BPM 可调**:所有时间相关参数从 BPM 派生,SC 端只接受绝对秒数,不知道 BPM 存在。
- **调性可调**:配置只写级数("1#^"、"6_"),运行时由 Tonality 翻译成具体音高。改一行 `key: "G"` 就完成移调。
- **音色可换**:ring → SynthDef 的映射独立配置,换音色不动音乐数据。
- **结构可换**:和弦进行、旋律、鼓 pattern 都是 YAML 数据。换一首曲子就是换一组数据。

**走一遍数据流**(以一个具体音为例)。假设当前时刻:BPM=120, key=C,当前和弦是 2m9,扫描线正走到 slice 4,R4 slice 4 上有一颗石头。这一音的"身份"在每层是这样的:

|Layer|它长什么样|
|---|---|
|配置|`"2"`(字符串,melody 表里的一格)|
|调度|`slice=4`(不知道音是什么)|
|事件|`NoteEvent(ring=4, degree="2", ...)`|
|桥|`parsed=(2, 0, 0)` → `midi=62` → `freq=293.66`|
|SC|`freq=293.66 Hz`(不知道它叫"2"、"D",也不知道 key)|

整条路径上**"具体音高"只在桥层那一瞬间存在**。这就是为什么改一行 `key: "G"` 之后,整个配置和事件流都不用动——唯一变化的是桥层调用 Tonality 时拿到的映射表。

---

### 5.4 目录结构

```
soundmat/                                ─── 仓库根 (src/soundmat/) ───
├── README.md
├── SETUP.md                             # 上机部署与校准说明
├── pyproject.toml
├── uv.lock
│
├── manifest/
│   ├── ambient/
│   │   └── kyoto.toml
│   └── jam/
│       ├── lofi_1.toml                  # 默认启动 manifest
│       ├── lofi_1b.toml
│       └── data/
│           ├── progressions/
│           ├── melodies/
│           ├── drums/
│           ├── rings/
│           │   └── lofi.yaml
│           └── lofi_mapping.yaml
│
├── soundmat/                            ─── Python 包 ───
│   ├── __init__.py
│   ├── __main__.py                      # CLI 入口；启动 scsynth / 串口 / Web
│   ├── config.py                        # 全局常量（校准默认、总线号、Jam 行为）
│   ├── app.py                           # ModeManager + manifest 加载
│   │
│   ├── core/
│   │   ├── sc_server.py                 # scsynth 子进程 + .scsyndef 加载
│   │   ├── osc.py                       # OSC 客户端（节点 ID 自 100000 起）
│   │   ├── esp32_serial.py              # 串口 auto 识别、打开、boot 等待
│   │   ├── services.py                  # SharedServices
│   │   ├── sensor/
│   │   │   ├── reader.py                # SensorReader 抽象 + 订阅
│   │   │   ├── serial_reader.py         # ESP32 S 帧读取
│   │   │   ├── mock_reader.py           # mock / .npz 回放 / Web 垫面注入
│   │   │   ├── frame.py                 # S 帧解析与校验
│   │   │   ├── map.py                   # Wire → 逻辑 (ring, sector) S→L 映射
│   │   │   └── normalize.py             # wire slice 列镜像（部署可调）
│   │   └── led/
│   │       ├── writer.py                # L 帧编码 + 60Hz 发送
│   │       └── offset.py                # 物理 LED 旋转
│   │
│   ├── web/
│   │   ├── server.py                    # FastAPI：HTTP + WebSocket 全在此
│   │   └── static/
│   │       ├── index.html               # Control：模式切换、音量、BPM
│   │       ├── mat.html                 # Mat：热力图、虚拟垫、Calibration
│   │       ├── debug.html
│   │       └── soundmat.css
│   │
│   ├── modes/
│   │   └── base.py                      # ModeApp Protocol
│   │
│   ├── ambient/
│   │   ├── app.py
│   │   ├── tracker.py
│   │   ├── state.py
│   │   ├── mapping.py
│   │   ├── voices.py
│   │   ├── buffers.py
│   │   └── led.py
│   │
│   └── jam/
│       ├── app.py                       # ~200Hz 主循环
│       ├── types.py
│       ├── config_loader.py
│       ├── ring_config.py
│       ├── theory/                      # degree, tonality, tempo
│       ├── scheduler/                   # transport, scanline, song_position, timing
│       ├── event/                       # sensor_state, harmony/drum/event_engine
│       ├── bridge/                      # synth_bridge, master_fx
│       └── led/                         # renderer, layers（调色板/几何/包络）
│
├── sc/
│   ├── synthdefs/
│   │   ├── core/                        # master, reverb, players
│   │   ├── ambient/                     # diapason, marimba
│   │   └── jam/
│   │       ├── 00_common.scd            # 共享 ugen 辅助
│   │       ├── master.scd               # jam_master（三总线 + Lo-Fi）
│   │       ├── sub_bass.scd, pluck_bass.scd, pad_pluck.scd, rhodes.scd, marimba.scd
│   │       ├── chord_pad.scd
│   │       └── drums/                   # kick, snare, hihat
│   ├── assets/samples/
│   ├── compiled/                        # *.scsyndef
│   └── compile.scd
│
├── scripts/
│   ├── compile_synths.py
│   └── replay_test.py
│
└── tests/                               # pytest（含 sensor_map、led、integration 等）
```

### 5.5 几个关键文件的解释

**`jam/types.py`** — 契约文件：`NoteEvent`、`ChordEvent`、`ParamEvent`、`SliceTick`、`SongPosition` 等。`NoteEvent` 含 `source_slice`（LED 命中闪）、`when`（预留）；和声走 `ChordEvent` 而非 `NoteEvent`。

**`core/sensor/map.py` + `normalize.py`** — S 帧为 wire 坐标 `(ring, slice)`；经可选列镜像 + `SECTOR_OFFSET` 旋转得到逻辑 `(ring, sector)`（恒 32 sector）。内圈 R0/R1 在 pre-offset 层由 16 个有效 wire slice 映射。Jam `SensorState` 与 Ambient `Tracker` 均在此逻辑坐标上阈值化。

**`core/sensor/reader.py` vs `serial_reader.py` / `mock_reader.py`** — 抽象接口 + 真串口 / mock 实现。`_emit()` 时统一做 wire 镜像。模式 app 只消费 `latest()` / `subscribe()`。

**`core/esp32_serial.py`** — `pick_serial_port("auto")`、921600 打开、首帧 S 帧 boot 等待（8s）。

**`config.py`** — 部署默认：`SENSOR_THRESHOLD=500`、`CONTROL_SUM_MIN=250`、`CONTROL_MAX=1000`（Lo-Fi 映射上限）、`SECTOR_OFFSET=4`、`LED_OFFSET=101`、`WIRE_SLICE_MIRROR=True`；Jam 放石 preview 音量 `JAM_IDLE_PLACE_PREVIEW_VEL=0.5`、`JAM_LOOP_PLACE_PREVIEW_VEL=0.25`（0=关）；串口断开 `SERIAL_LOST_EXIT_SEC=3` 后进程退出。

**`core/services.py`** — `SharedServices` 打包 sc / sensor / leds / osc，以及 `serial_port`、`serial_ready`。

**`modes/base.py`** — `ModeApp` Protocol（`start` / `stop` / `status` / `set_param`）。

### 5.6 Manifest 的引用关系

Jam 模式的 manifest 文件本身是个"装配清单",指向各个数据文件:

```toml
# manifest/jam/lofi_1.toml
mode = "jam"
name = "Lo-Fi Loop · Progression 1"
description = "京都夜雨,2m9 → 513 → 1maj9 → 69"

[music]
bpm = 120
key = "C"
scale = "major"

[refs]
progression = "1"      # → data/progressions/1.yaml
melody_pack = "1"      # → data/melodies/1/
drums = "lofi_loop"    # → data/drums/lofi_loop.yaml
rings = "lofi"         # → data/rings/lofi.yaml
lofi_mapping = "default"
```

这样的好处是灵活性:同一套 melody 数据可以被进行 1 和 1B 共用(如果作曲家选择),也可以分别独立。Ambient 模式的 manifest 同理,声明该 preset 用哪些样本组、ring 怎么映射等。

---

## 6. Web 控制台

### 6.1 设计动机

SoundMat 上没有物理按钮(为了保持装置美学纯粹)。但开发、调试、Demo 阶段需要某种方式控制系统:切换模式、启停、调参数。Web 控制台是最优雅的方案——树莓派开一个轻量 HTTP 服务,手机扫码访问,装置外观零改动。

更重要的是,Web 控制台不只是为模式切换而做的,它是开发整个项目的基础设施:

- 实时显示传感器热力图(调试神器)
- 可视化扫描线进度
- 调 BPM、切换 manifest 而不重启
- 录制传感数据用于离线回放
- 性能监控(CPU、SC 服务器状态)

### 6.2 控制台页面

| 路径 | 页面 | 作用 |
| --- | --- | --- |
| `/` | Control (`index.html`) | 模式切换、音量、Jam BPM、Place preview 滑条、Developer Restart/Stop |
| `/mat` | Mat (`mat.html`) | 实时热力图、Calibration、mock 虚拟垫与 LED 镜像 |
| `/heatmap`、`/pad` | 同 Mat | 别名 |
| `/debug` | Debug | 调试 |

**Jam 启停**：播放由 **R0/R1 控制石**（压力之和 ≥ `CONTROL_SUM_MIN`）驱动，不是 Control 页的 Transport。Control 页 **Restart/Stop** 仅重启/停止**当前模式线程**（Developer 区说明）。

### 6.3 HTTP / WebSocket API

```
GET  /                          # Control 主页
GET  /mat                       # Mat 页（热力图 + 校准）
GET  /debug

GET  /api/status                # 模式状态 + 校准参数 + app 子状态
GET  /api/manifests             # 可用 manifest 列表
POST /api/mode                  # {"manifest": "…/lofi_1.toml"}
POST /api/transport             # {"action": "start"|"stop"} 模式 lifecycle
POST /api/params                # 全局或模式参数（见下）

POST /api/mock/cells            # mock 模式：注入 {(ring,sector),…}

WS   /api/sensor_stream         # 传感矩阵 ~30fps
WS   /api/event_stream          # 状态快照 ~10Hz（调试）
WS   /api/mock/view             # mock：LED buffer + status ~40fps
```

**`POST /api/params` 全局键**（`ModeManager`，重启恢复默认）：`sector_offset`、`led_offset`、`sensor_threshold`、`control_min`、`control_max`、`control_sum_min`、`wire_slice_mirror`、`jam_loop_place_preview_vel`（0–1，0=关）。模式级键如 `bpm`、`master_volume` 转发给当前 `ModeApp.set_param`。

### 6.4 实现要点

- FastAPI + uvicorn，**单文件** `web/server.py`（路由与 WebSocket 同处）
- 静态 HTML/JS + `soundmat.css`，无前端框架
- 直接持有 `ModeManager` 引用
- Mat 页 Calibration 可调 sector/LED/threshold/Lo-Fi/control sum（**不持久化**，重启恢复 `config.py` 默认）

---

## 7. 启动流程

```
$ uv run soundmat [manifest/jam/lofi_1.toml]   # 默认 lofi_1，非 kyoto
   ↓
__main__.py:
  1. 解析 CLI（--mock、--port、--no-serial、--no-web、--no-sc、--list-ports）
  2. 启动 scsynth（-u 57110 -i 0 -o 2 -S 44100）；失败最多重试 5 次
  3. load_synthdefs(sc/compiled)
  4. 打开 ESP32 串口（auto），等待首帧 S（8s）；失败则转 mock
  5. SensorReader + LEDWriter 共用串口；LED 60Hz 发 L 帧
  6. SharedServices → ModeManager → switch_to(initial_manifest)
  7. Web 后台线程（可选）
  8. 主线程等待；串口运行中断开 → 3s 后自动退出并清理
```

scsynth **常驻**；模式切换只 free/new SC group。SynthDef 启动时一次加载完。

---

## 8. 模式切换流程

```
浏览器: POST /api/mode {"manifest": "jam/lofi_1.toml"}
   ↓
ModeManager.switch_to():
  1. 取锁
  2. current_app.stop():
       - 停止自己的主循环线程
       - 取消订阅 SensorReader
       - 清空 LEDWriter 的数据源
       - sc.free_group(my_group)  ← 一次性杀光所有自己的 synth 节点
  3. 加载新 manifest
  4. 根据 manifest.mode 选 ModeApp 类(AmbientApp / JamApp)
  5. new_app = ModeAppClass(manifest, services)
  6. new_app.start():
       - sc.new_group() → 拿到自己的 group ID
       - 启动自己模式特定的初始 synth(如 master FX)
       - 订阅 SensorReader
       - 注册 LEDWriter 数据源
       - 启动主循环线程
  7. current_app = new_app
  8. 释放锁
```

整个切换过程在 100-300ms 量级。可以在 stop/start 之间加全局淡入淡出做更自然的过渡,但 prototype 阶段不必。

**SC group 隔离**是关键设计:每个模式启动时新建一个 SC group,所有自己的 synth 都 spawn 在这个 group 下。停止时 `n_free` 整个 group——所有声音立刻干净消失,不需要追踪每一个 synth ID。

---

## 9. 模式主循环结构

两个模式的主循环结构截然不同,这正是为什么不强行抽象统一接口的原因。

### Ambient 主循环(20 Hz,reconcile-based)

```
loop @ 20Hz:
    frame = sensor.latest()
    occ = tracker.occupied(frame.matrix)       # 逻辑坐标 + 阈值
    state, events = state_model.update(occ)  # placed / removed 边沿
    result = mapper.map(state, events)
    voices.reconcile(result); voices.pump(t)
    leds.set_buffer(render_led(t, occ))
```

mapper 给出"声明",voices 执行"调和",scsynth 真正发声——这条链路保持每帧 20Hz 的稳定推进。

### Jam 主循环(~200 Hz,连续时间 + 扫描触发)

Jam **不是** 16 分音符 tick 上统一 `emit(tick)`。实际逻辑:

```
loop @ ~200Hz:
    frame = sensor.latest()
    delta = sensor_state.update(frame)     # occupied/placed/removed, Lo-Fi, control_active

    master_fx.set_lofi(delta.control_value)   # R0/R1 压力之和 → 0..1000，连续实时

    if not control_active:               # R0/R1 压力和 < CONTROL_SUM_MIN（含 100ms 释放 hold）
        reset transport/scanline/event（边沿）; 空闲放石 preview（JAM_IDLE_PLACE_PREVIEW_VEL）
        render LED（全环呼吸 0–20）; return

    transport.start() on first control      # 有控制石 → 开拍
    if not transport.playing:             # 曲终：等清空 R0/R1
        render LED; return

    prev_t, curr_t = transport.advance(dt)
    harmony.emit(prev_t, curr_t) → bridge   # ChordEvent，按时间区间
    drum.emit(prev_t, curr_t) → bridge      # 16 分 tick

    prev_a, curr_a, wrap = scanline.update(curr_t)
    optional: placed preview if JAM_LOOP_PLACE_PREVIEW_VEL > 0
    notes = event_engine.emit_sweep(...)    # 扫描线过扇区中心 → 旋律/bass
    bridge.handle(notes); LED scan hit / preview

    leds.set_buffer(jam_led.render(...))    # 播放：扫描尾迹 + 卡位呼吸；空闲：暗呼吸
```

**控制石判定**：`control_active = (R0+R1 全格压力之和) ≥ CONTROL_SUM_MIN`，与单格 threshold 独立。单格 threshold（默认 500）仍决定 occupied/placed。

**音频总线**（`jam_master`）：旋律+bass → bus 2（gain 0.9）、和声 → 4（0.4）、鼓 → 6（0.62）→ 硬件 out 0。

---

## 10. Manifest 参数说明

### 10.1 通用参数(所有 manifest)

|参数|类型|说明|
|---|---|---|
|`mode`|string|模式标识,目前为 `"ambient"` 或 `"jam"`|
|`name`|string|此 manifest 的显示名,用于 Web 控制台|
|`description`|string|简短描述,可选|

### 10.2 Ambient 模式参数



### 10.3 Jam 模式参数

**`[music]` 块**:

|参数|类型|说明|
|---|---|---|
|`bpm`|int|节拍速度。120 为默认。可在运行时通过 Web 控制台调整。|
|`key`|string|调性根音,例如 `"C"`、`"G"`、`"F#"`。改这一项即完成全局移调。|
|`scale`|string|音阶类型,如 `"major"`、`"natural_minor"`、`"dorian"`。|
|`master_volume`|float|主输出音量,0.0 - 1.0。|

**`[refs]` 块**(指向 data/ 下的具体配置):

|参数|类型|说明|
|---|---|---|
|`progression`|string|和弦进行名,对应 `data/progressions/<name>.yaml`|
|`melody_pack`|string|旋律包名,对应 `data/melodies/<name>/`|
|`drums`|string|鼓配置名,对应 `data/drums/<name>.yaml`|
|`rings`|string|Ring 角色 + 音色映射,对应 `data/rings/<name>.yaml`|
|`lofi_mapping`|string|Lo-Fi 强度到 SC 参数的映射曲线名|

### 10.4 各 data 文件的字段

**`progressions/<name>.yaml`** — 和弦进行:

```yaml
chords:
  - {id: "2m9",   bars: 2}
  - {id: "513",   bars: 2}
  - {id: "1maj9", bars: 2}
  - {id: "69",    bars: 2}
```

**`melodies/<name>/<chord_id>.yaml`** — 一个和弦下的旋律触发音表:

```yaml
# 8 个 8 分音符位置上,各 ring 该响什么级数
R7: ["3^", "1^", "2^", "3^", "3^", "2^", "1^", "6"]
R6: ["1^", "5", "6", "1^", "1^", "5", "6", "3^"]
R5: ["6", "3", "4", "6", "6", "4", "3", "2"]
R4: ["4", "3", "2", "3", "4", "3", "2", "3"]
R3: ["4_", null, "6_", null, "4_", null, "6_", null]
R2: ["2_", null, "2_", null, "2_", null, "2_", null]
```

`null` 表示该位置不触发音。

（记号：X=X4, X^=X5, X_=X3, X__=X2（1=C时））

**`drums/<name>.yaml`** — 鼓 pattern 与循环序列:

```yaml
patterns:
  A: {kick: [...], snare: [...], hihat: [...]}    # 16 个 16 分音符位
  B: {kick: [...], snare: [...], hihat: [...]}
  C: {kick: [...], snare: [...], hihat: [...]}
  D: {kick: [...], snare: [...], hihat: [...]}
sequence: [A, B, C, C, A, D, D, A]    # 整曲 8 遍的播放顺序
```

**`rings/<name>.yaml`** — Ring 角色 + SynthDef 名 + gate/gain（当前 lofi 摘录）:

```yaml
R0: {role: control, param: lofi_amount, range: [0, 1000]}
R1: {role: control, param: lofi_amount, range: [0, 1000]}
R2: {role: bass,   instrument: jam_sub_bass,   note_sec: 0.25, tail_sec: 0.1,  gain: 2.9}
R3: {role: bass,   instrument: jam_pluck_bass, note_sec: 0.5,  tail_sec: 0.15, gain: 3.1}
R4: {role: melody, instrument: jam_pad_pluck,  note_sec: 1.28, gain: 2.75}
R5: {role: melody, instrument: jam_rhodes,     note_sec: 0.74, gain: 3.45, params: {far: 1}}
R6: {role: melody, instrument: jam_rhodes,     note_sec: 0.82, gain: 3.45, params: {far: 0}}
R7: {role: melody, instrument: jam_marimba,    note_sec: 2.012, gain: 2.75}
```

**`lofi_mapping.yaml`** — Lo-Fi 0–1000 → `jam_master` 的 **cutoff + drive**（分段线性）:

```yaml
master:
  cutoff: {0: 14000, 250: 9500, 500: 6447, 750: 4376, 1000: 2425}
  drive:  {0: 0.0, 250: 0.00625, 500: 0.0125, 750: 0.01875, 1000: 0.025}
```

公式：`cutoff = 14000·(420/14000)^(level/2000)`，`drive = level/40000`。和声/鼓总线增益**不**随 Lo-Fi 变化。

---

## 11. 开发环境

### 11.1 包管理:uv

项目使用 **uv** 管理 Python 环境与依赖。uv 是 Astral 出品的 Python 包管理工具,相比传统 `pip + venv` 速度快一个数量级,且能完整锁定依赖。

常用命令:

```bash
uv sync                        # 安装依赖
uv add <package>
uv run soundmat                  # 默认 manifest/jam/lofi_1.toml
```

依赖锁定文件 `uv.lock` 提交到版本控制,保证开发机与 Pi 部署环境一致。

### 11.2 SC 端编译

SC 端的 SynthDef 用 sclang 编译成 `.scsyndef`:

```bash
sclang sc/compile.scd
```

编译产物输出到 `sc/compiled/`,运行时由 scsynth 一次性加载。

### 11.3 离线开发(无硬件)

```bash
uv run soundmat --mock              # 手动 Web 垫面注入
uv run soundmat --mock recording.npz
uv run soundmat --no-sc             # 无音频，仅逻辑/LED
uv run soundmat --list-ports
```

`mock_reader` + Mat 页 `/api/mock/cells`；`--mock` 时自动 `WIRE_SLICE_MIRROR=False`（虚拟垫已是 CW slice）。串口打开失败也会转 mock。

`scripts/replay_test.py` 可离线回放录制矩阵。Web「录制传感」尚未实现。

---

## 12. 关键接口与协议

### 12.1 模式协议

任何模式只要实现以下四个方法就能被 ModeManager 管理:

```python
class ModeApp(Protocol):
    def __init__(self, manifest: dict, services: SharedServices): ...
    def start(self) -> None: ...
    def stop(self) -> None: ...
    def status(self) -> dict: ...
    def set_param(self, key: str, value: Any) -> None: ...
```

不是严格的抽象基类,只是约定(duck typing)。

### 12.2 SharedServices

打包共享底层服务:

```python
@dataclass
class SharedServices:
    sc: SCServerHandle
    sensor: SensorReader
    leds: LEDWriter
    osc: OSCClient
    serial_port: str | None = None
    serial_ready: bool = False
```

### 12.3 Jam 模式核心事件类型

```python
@dataclass
class NoteEvent:
    ring: int
    degree: str | None = None
    voice: str | None = None       # 鼓: kick/snare/hihat
    velocity: float = 1.0
    sustain: float = 0.5           # 秒
    pan: float = 0.0
    when: float = 0.0
    source_slice: int | None = None  # LED 用


@dataclass
class ChordEvent:
    symbol: str
    degrees: tuple[str, ...]
    hold: float
    release_first: bool = True


@dataclass
class ParamEvent:
    param: str
    value: float


@dataclass
class SliceTick:
    slice: int
    timestamp: float
    did_wrap: bool = False


@dataclass
class SongPosition:
    chord_idx: int
    bar: int
    sub_loop: int
    bar_global: int = 0
```

---

## 13. 实现状态（相对本文档初稿）

已基本落地：`core/`、`ambient/`、`jam/` 全链路、`web/` Control+Mat、`ModeManager` 模式切换、Jam LED 扫描/呼吸/预览、S→L 校准、控制石 sum + 释放 hold、放石 preview、串口断开 3s 退出、scsynth 启动重试。

待完善或可选：传感录制、Ambient 上机样本完整性校验、模式切换淡入淡出、更丰富的 Debug 事件流。

上机步骤与校准项见仓库 **`SETUP.md`**。
