# 10c · 音频输出 (`10-audio-output`)

- **时长**：约 30 秒
- **上接**：`10-power-outdoor`（USB-C 供电）

## 屏上

- 标题：**USB-C audio** · 副标题：**Hardware DAC to the room**
- 图：单条音频链路（无分支）— Pi **USB-A** → **A→C** → **USB-C** → **USB DAC** → **3.5 mm Aux** → 外置音响
- 右侧：板载 PWM 不可接受；I2S 可行但麻烦；选 **USB DAC** + 完整线缆链路

## 讲稿

和供电一样，音频也走 **USB-C** 这条线。树莓派 **3B 板载 3.5 mm 是 PWM 模拟**，不是真 DAC，信噪比差——在安静的公共空间当艺术装置，这不能接受。**I2S DAC** 音质好，但要占 GPIO、接线更烦。**USB 外置 DAC** 最简单：插上就被识别成声卡。
链路是：**USB-A** → **A 转 C 转接头** → **USB-C 延长线** → **USB DAC** → **3.5 mm Aux** → **Aux 线** → **外部音响**。从花盆排水孔出线，和供电口一样，都是标准 USB-C 生态。
