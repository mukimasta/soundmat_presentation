# SoundMat Presentation 设计文档

## 一、设计哲学

整个 presentation 不是一种风格走到底，而是三种 slide 类型混搭，形成节奏：

**Hero Slide**——纯 typography，全屏一句话，类似"Place stones. Make music."这种。用于章节开场、关键论点、情绪转换。

**Bento Slide**——多卡片网格，一屏铺开 4–6 个 feature。用于展示一个模块的多个面向（比如传感器的"设计原理 / 实物照 / 规格数字 / 对比决策"四件套）。

**Zoom Slide**——全屏一张图或一个数字。用于系统架构图、关键 wow 数字、传感器特写。

三种交替出现，避免"全是密集网格"的疲劳，也避免"全是大字号"的空洞。整场 presentation 的视觉节奏类似 Apple Keynote 现场——大字号开场 → 切到 bento 展示细节 → zoom 进某个特写 → 回到 bento 推进 → 大字号收束。

## 二、视觉系统

**配色** 走苹果近期发布会的浅色路线，不是早期黑底：

- 主背景：白 `#FFFFFF` 或几乎白的浅灰 `#F5F5F7`
- Bento 卡片底色：根据内容自由——浅灰卡 `#FAFAFA`、深色卡 `#1D1D1F`（用于强调/反差）、彩色卡（少量，用于装置实物对应的暖橙黄 `#F5A623`，呼应 LED 视觉）
- 文字：黑 `#1D1D1F`（主）/ 灰 `#86868B`（次）

**字体**

- 西文标题/正文：SF Pro Display + SF Pro Text，开源近似用 Inter
- 中文：PingFang SC，web 近似用 Noto Sans SC
- 数字/技术参数：SF Mono 或 JetBrains Mono

**字号梯度**（按屏幕高度 1080 计）

- Hero title: 120–160px
- Bento card title: 28–36px
- Bento card body: 18–22px
- Wow 数字: 80–120px（特别大）
- Caption / footnote: 14–16px

**圆角**：统一 20px，所有卡片、图片、视频容器都用这个值。这是苹果美学的核心细节。

**留白**：卡片间 gap 24–32px，slide 四周 padding 64–96px。**白比内容多**。

## 三、Slide 清单与类型分配

按 10 分钟节奏，约 13–14 张：

|#|类型|内容|用时|
|---|---|---|---|
|1|Hero|"SoundMat" + 副标|20s|
|2|Hero|"Place stones. Make music."（双拍出）|30s|
|3|Bento|Idea → Constraints 桥（4 cards：装置渲染图 + 3 个工程约束卡）|60s|
|4|Zoom|完整系统架构图全屏|60s|
|5|Bento|传感器（5 cards：极坐标图、对比表、实物照、三明治结构、数字"224 zones"）|90s|
|6|Bento|电子系统（5 cards：电源链图、洞洞板照、模块分工、USB DAC 决策、PD 20V 数字）|90s|
|7|Bento|固件 + 串口协议（3 cards：扫描时序、S/L 帧格式、性能数字）|45s|
|8|Hero|"Logic in Python. Sound in SuperCollider."（对仗句）|15s|
|9|Bento|软件架构（4 cards：架构图、模式切换、Web 控制台截图、SC group 隔离）|60s|
|10|Bento|Jam Mode 声音化（4 cards：8 ring 角色环形图、扫描线+量化、和弦进行表、Lo-Fi 调控）|90s|
|11|Zoom|Ambient mode 一张图 + 一句字 "Still iterating."|20s|
|12|Bento|挑战与迭代（3 cards：PD trigger 换型、Micro USB → breakout、Lo-Fi 自由度悖论）|45s|
|13|Hero|"Live Demo" 全屏|5s|
|14|Closing|致谢 / Q&A|—|

## 四、Bento Slide 的内部规则

每张 Bento 必须有**一张 hero card**（占面积 ~40–50%），其余为 supporting cards（中卡 ~20%、小卡 ~10%）。这是苹果 bento 的核心——不是均匀网格，而是**面积本身在表达 hierarchy**。

**卡片内容模式**只有三种：

1. **Image-dominant**：整张卡是一张图（实物照、渲染图、示意图），文字以小 caption 形式在底部或角落
2. **Number-dominant**：超大数字 + 一行说明，例如"`224` sensing zones"
3. **Text-dominant**：标题 + 一段短描述，无图

**禁止**做的：

- 一张卡里塞太多文字（超过 30 字就该拆）
- 卡片内部还有 bullet list（违背 bento 的"一卡一事"原则）
- 用 emoji 装饰（苹果发布会不用 emoji）

**布局模板**（按 cards 数量）：

- 4 cards: 1 大 + 3 中（大居左占整列高，3 中堆右列）
- 5 cards: 1 大 + 2 中 + 2 小
- 6 cards: 2 中 + 4 小
- 3 cards: 1 大 + 2 中 横排

不要超过 6 个卡。超过就拆成两张 slide。

## 五、动效系统

**全场只用三种动画**，保持一致：

- **Stagger fade up**: element 从 y=20px 淡入到 y=0，每个元素错开 80–120ms。用于 hero text 出现、bento 卡片进入。
- **Scale fade**: scale 0.96 → 1.0 + opacity 0 → 1。用于 zoom slide 的 hero 元素。
- **Count up**: 数字从 0 滚到目标值，800–1200ms。只用在 wow 数字 slide（224, 32, 921600, 20Hz, <50ms 这种）。

**通用参数**：

- Duration: 700ms (default), 900ms (hero text)
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`（这是苹果常用的 ease-out-quart）
- 不要用 linear、ease、ease-in-out 这种 web 默认 easing

**每张 slide 的进入序列**：

按 z-order 由大到小、由背景到前景进入。Bento slide 通常是：大卡 → 中卡 → 小卡 → caption。每张 slide 总进入时间不超过 1.5s，否则讲解节奏被拖。

**禁止**：

- parallax 滚动效果（你是按键切页，不是滚动）
- 卡片 hover 动画（presentation 没人 hover）
- 持续循环动画（极个别 LED 发光卡可以呼吸，其他全部静态）
- 切页 transition 用 slide / flip / cube 等花哨效果——**只用 fade**

## 六、技术实现策略

**框架选择**: Reveal.js 5.x。理由是它内置键盘控制、speaker notes、PDF 导出、fragment 系统，全是你需要的，没有学习成本。Bento layout 完全靠自定义 CSS Grid 实现，不依赖框架。

**项目结构**：

```
soundmat-deck/
├── index.html              # 主入口，所有 slide 的 HTML
├── css/
│   ├── reveal-base.css     # Reveal.js 自带
│   ├── theme-apple.css     # 自定义 Apple-style theme（核心）
│   └── slides.css          # 每张 slide 的特殊布局
├── fonts/                  # 本地字体（必须本地化）
│   ├── SF-Pro-Display.woff2
│   ├── Inter-*.woff2
│   └── PingFang-SC.woff2
├── images/                 # 你已有的所有图片
│   ├── hero-装置.jpg
│   ├── sensor-极坐标.png
│   ├── pcb-洞洞板.jpg
│   └── ...
└── js/
    ├── countup.js          # 数字滚动动画
    └── stagger.js          # 卡片错开进入
```

**关键技术点**：

1. **字体本地化**——所有字体下载为 .woff2 放到 fonts/ 目录，CSS 用 `@font-face` 引用。**严禁**用 Google Fonts CDN，demo 现场网络可能挂掉。
2. **图片预加载**——slide 1 加载时把所有图预加载到内存，防止切到后面 slide 时图片闪现。
3. **Bento 用 CSS Grid 实现**——`grid-template-columns: repeat(12, 1fr)` 配合每张卡的 `grid-column` / `grid-row` 跨度。不要用 flexbox 硬撑。
4. **动画用 CSS @keyframes + JS 触发**——Reveal.js 切到某 slide 时给元素加 class 触发动画。不需要 Framer Motion 或 GSAP，纯 CSS 足够。
5. **响应式按视口缩放**——所有尺寸用 `vw` 或 `clamp()`，避免投影仪分辨率不一致时排版崩。

## 七、内容资源盘点

你已有可以直接用的素材（来自项目文档）：

- 装置渲染图（Gemini 生成 + ChatGPT 修改的两张）
- 传感器极坐标设计图（`stitched-side-by-side.png`）
- 电子系统架构图（四张分模块图）
- 洞洞板布局照片
- PD trigger / Buck converter 实物照
- 各种 schematic 示意图（三明治结构、ghost path 解析等）
- BOM 表
- 各种数字（224 zones, 32 slices, 8 rings, 921600 baud, 20Hz, 108 LEDs 等）

**还需要补一两张**（如果可能）：

- 装置最终成品照（带石头、亮灯，俯视角度）——这是 hero slide 的脸面
- Live demo 准备好后录一段 5 秒钟的视频片段，可以放在 hero slide 做背景动效

**严格按你要求**：不制作新图。已有素材已经够用。

## 八、动画 + 节奏的隐含规则

整场 presentation 的"呼吸"由 hero 和 bento 的交替决定：

- 连续两张 bento 会让观众疲劳——中间插一张 hero 或 zoom
- 连续两张 hero 会让观众觉得"信息太稀"——中间插一张 bento
- 每个模块（sensor / electronics / software）的开头都该有一个"宣告"——可以是 hero 或 zoom，不要直接进 bento

**讲解时长配速**：

- Hero slide: 5–30s（讲完一句话就走）
- Bento slide: 45–90s（每个卡 10–15s 讲到）
- Zoom slide: 20–60s

**Speaker notes 写法**：每张 slide 在 Reveal.js 的 notes 区写"重点讲什么 + 不要展开什么 + 大概用时"。例如：

> Slide 5 - Sensor (60s)
> 
> - 重点：为什么极坐标——决策推理
> - 数字 wow：224 zones
> - 不要展开：ghost path 详细原理（一句话带过）

## 九、兜底方案

**必做**：

1. **导出 PDF 版本** —— Reveal.js 支持 `?print-pdf` URL 参数，导出后用 Chrome 打印为 PDF。这是浏览器抽风时的 last resort。
2. **离线运行测试** —— 把整个项目拷到 U 盘，断网在另一台机器跑一遍，确认所有字体、图片、动画都本地化。
3. **教室提前彩排** —— 至少提前一天去 demo 教室用同一台电脑试投影，看分辨率、字号、颜色在投影仪上的实际效果。
4. **键盘控制最小化** —— 只用空格键推进、左右箭头切页、Esc 进入 overview。不要发明自定义快捷键，紧张时会按错。

**应急**：

- 如果 demo 当天网页版突然挂了 → 切 PDF 直接讲
- 如果某个动画卡顿 → Reveal.js 有 `data-transition="none"` 可以单独禁用某 slide 动画
- 如果时间不够 → 跳过 slide 7（Firmware）和 slide 12（Challenges），优先保 demo

## 十、交付物清单

最终需要交付的文件：

1. `index.html` + CSS + JS + fonts + images —— 完整的 web slide deck
2. `soundmat-deck.pdf` —— 导出的 PDF 备份
3. `speaker-notes.md` —— 每张 slide 的讲稿大纲（独立文档，方便你打印或在另一屏看）
4. `README-demo.md` —— 现场操作指南（怎么启动浏览器、F11 全屏、用什么键切页、出错怎么办）
