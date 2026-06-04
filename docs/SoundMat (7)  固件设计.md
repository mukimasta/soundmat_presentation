
固件设计要做的其实是 ESP32 单片机上的软件设计。固件设计作为连接传感器/电路设计和声音化设计的桥梁，将原始的传感器硬件信号发送给电脑，连接后续的音乐生成；同时也将电脑端的 LED 控制信号输出，控制 SoundMat 上的灯光。

固件架构如下，分为四个模块：

```c
loop() {
  scan_sensors();      // 传感器扫描模块
  send_sensor_data();  // 传感器数据发送模块
  receive_led_data();  // LED数据接收模块
  update_leds();       // LED刷新模块
}
```

```
初始化（引脚、ADC、Serial、LED）

主循环：
  1. 扫描传感器阵列 → 得到 pressure_matrix[ring][slice]
  2. 将 pressure_matrix 发送到电脑
  3. 接收电脑回传的 LED 状态数据
  4. 驱动 LED 更新显示
```




## 传感器扫描模块

[[SoundMat (5)  传感器原理及设计]] 中提到了传感器检测的原理。在检测一个坐标 `(ring, slice)` 时，我们将当前 ring 对应引脚输出设置为 HIGH，其他设置为 LOW，然后读取 slice 端的电压，也就是调整 MUX 控制信号使其输出当前 slice 的信号并读取。

一些决策：
1. ADC 可以用多次采样取平均，降噪，不过目前先仅进行单次采样，效果正常

伪代码：
```c
scan_sensors() {
    // 清空压力矩阵，-1 表示未采集
    for all [ring][slice] {
        pressure[ring][slice] = -1
	}

    for ring in 0..NUM_RINGS-1 {
        // 激活当前 ring，其余拉低（防止 ghost path）
        set_all_rings(LOW)
        set_ring(ring, HIGH)
        delay_ms(RING_SETTLE_MS)  // 等待 ring 线电压稳定

        for slice in 0..NUM_SLICES-1 {
            // 设置 MUX 地址线，选通当前 slice 通道
            mux_select(slice)
            delay_ms(MUX_SETTLE_MS)  // 等待 MUX 切换稳定

            // 读取 ADC
            raw = adc_read(SIG_PIN)
			pressure[ring][slice] = raw
		}
        // 当前 ring 扫描完毕，拉低，为下一个 ring 做准备
        set_ring(ring, LOW)
	}
	return pressure
}
```

我们使用的 CD40678M，使能是是低电平有效。


## 串口数据模块

ESP32 向电脑端发送原始 ADC 值，不做校准或转换；电脑端发送每颗 LED 的控制信号。

### 基本约定

| 项目  | 设定         |
| --- | ---------- |
| 波特率 | 921600     |
| 编码  | ASCII 文本   |

### 帧格式

所有帧遵循统一格式：

```
TYPE:PAYLOAD*XX\n
```

| 字段        | 说明           |
| --------- | ------------ |
| `TYPE`    | 单字符帧类型标识     |
| `:`       | 分隔符          |
| `PAYLOAD` | 帧数据，内容因帧类型而异 |
| `*`       | 校验分隔符        |
| `XX`      | 2 位十六进制校验码   |
| `\n`      | 帧结束符         |

**校验码计算：** 对从 `TYPE` 字符到 `*` 前最后一个字符（含 `TYPE` 和 `:`）的所有字节做 XOR，结果用 2 位大写十六进制表示。

### 帧类型

|方向|帧头|用途|
|---|---|---|
|ESP32 → Pi|`S`|传感器数据帧|
|Pi → ESP32|`L`|LED 控制帧|
|双向|`#`|注释/调试信息（接收方忽略）|
#### S 帧：传感器数据（ESP32 → Pi）

```
S:v0,v1,v2,...,v255*XX\n
```

256 个十进制整数，逗号分隔，值域 -1-4095（12-bit ADC 原始值，加上 -1 表示无效值）。排列顺序为 ring-major：

```
index = ring × 32 + slice
```

index 0-31 对应 Ring 0 的 Slice 0-31，index 32-63 对应 Ring 1，依此类推。内圈 Ring 0-1 物理上只有 16 个有效区，但仍发送 32 个值，合并交给 Pi 端处理。

**帧大小：** 约 1.2 KB（每个值平均 3-4 字符 + 逗号 + 帧头帧尾）。

**示例：**

```
S:4095,4093,4090,2031,...,3500,3498*A7\n
```

#### L 帧：LED 控制（Pi → ESP32）

```
L:RRGGBB,RRGGBB,...,RRGGBB*XX\n
```

108 个 6 位十六进制 RGB 值，逗号分隔。顺序按灯带物理编号，index 0 对应灯带第一颗 LED。

**帧大小：** 约 760 字节。

**示例：**

```
L:000000,0A0500,1A0F00,...,000000*3E\n
```

值域 0-4095（ESP32 12-bit ADC 原始值）。内圈 Ring 0-1 虽然只有 16 个有效区，仍然发送 32 个值（相邻两个 slice 覆盖同一物理区域），合并逻辑交给 Pi 端，固件保持简单。

#### # 帧：调试信息（双向）

```
# any text\n
```

以 `#` 开头的帧无校验，接收方读到后直接丢弃（或打印到 log）。用于启动信息、手动调试等。ESP32 上电时可发送：

```
# SoundMat firmware v1.0 ready\n
```


#### 通信时序

两端自由发送，互不阻塞。

ESP32 每完成一轮扫描立即发送 S 帧，不等待 Pi 回复。Pi 收到 S 帧后异步计算音乐和 LED，准备好了就发 L 帧。ESP32 每次 loop 开头非阻塞检查 Serial buffer，有完整 L 帧就更新 LED buffer，没有就沿用上一帧继续显示。

在串口连接后，esp32 在 boot 过程中，此时发送 led 信号无效。应等连接稳定后再通信。


> Claude:
> 
> #### 容错与工程约束
> 
> **Buffer 配置：** ESP32 端 Serial 接收 buffer 需扩大至 2048 字节（默认 256，装不下 760 字节的 L 帧）。Pi 端 pyserial 默认 buffer 足够。
> 
> **半帧保护：** 严格按行读取。只有读到 `\n` 才处理，buffer 中的不完整帧留待下次 loop 继续拼接。
> 
> **校验失败策略：** 直接丢弃，不重传。环境音乐场景下丢一帧完全无感知，重传机制会引入延迟和复杂度，对 prototype 来说得不偿失。
> 
> **帧率预算：** 921600 baud ≈ 92 KB/s。双向满载约 2 KB/帧，理论上限 ~46 fps。实际扫描+处理开销后预计稳定在 20-30 fps，对环境音乐响应绰绰有余。
> 

### LED刷新模块

将 LED buffer 中的 RGB 数据写入 WS2812B 灯带。

驱动方案：

WS2812B 要求的 800KHz 单线协议。我们使用 ESP-IDF 的 `led_strip.h`，底层基于 RMT 外设生成 WS2812B 时序。


## ESP32 程序设计


```
firmware/
├── main/
│   ├── main.c
│   ├── config.h
│   ├── sensor.h / sensor.c
│   ├── serial_comm.h / serial_comm.c
│   └── led_ctrl.h / led_ctrl.c
```

```c
// ========== Variables ==========
pressure_matrix[NUM_RINGS][NUM_SLICES]
led_buffer[NUM_LEDS]

app_main():
	// ========== 初始化阶段 ==========
	serial_init()
	uart_write("# SoundMat firmware v1.0 booting\n")
	sensor_init()
	led_init()
	uart_write("# init complete, entering main loop\n")
	
	while true:
		sensor_scan()
		serial_send_sensor_data(pressure_matrix)
		serial_try_receive_led_data(led_buffer) // non-blocking
		led_update()
		vTaskDelay(pdMS_TO_TICKS(LOOP_DELAY_MS)) // feed watchdog
	
```


## 常量表

| 常量                 | 值      | 含义                         |
| ------------------ | ------ | -------------------------- |
| `NUM_RINGS`        | 8      | 环形电极数量                     |
| `NUM_SLICES`       | 32     | 射线电极数量                     |
| `NUM_LEDS`         | 108    | LED 灯珠数量                   |
| `ADC_SAMPLES`      | 1      | 每点多采样次数，取平均降噪，1表示单词采样      |
| `ADC_BIT`          | 12     | ADC Bit 数量                 |
| `UART_BAUD`        | 921600 | 串口波特率                      |
| `UART_RX_BUF_SIZE` | 2048   | 接收 buffer，需容纳完整 L 帧        |
| `UART_TX_BUF_SIZE` | 0      | 发送 buffer，阻塞发送，保证帧完整       |
| `RING_SETTLE_US`   | 20     | ring 选通后等待电压稳定的延时（us）      |
| `MUX_SETTLE_US`    | 50     | MUX 地址切换后等待信号稳定的延时（us）     |
| `LOOP_DELAY_MS`    | 1      | 主循环末尾最小延迟 ms；喂看门狗 + 让出 CPU |
| `LED_COLOR_ORDER`  | GRB    | WS2812B 色序                 |

## 延迟分析




## 引脚对应

引脚对应，与 [[SoundMat (11)  电子系统制造]] 相同。

**Rings**

| Ring  | MCU IO |
| ----- | ------ |
| Ring0 | D19    |
| Ring1 | D5     |
| Ring2 | D21    |
| Ring3 | TX2    |
| Ring4 | D22    |
| Ring5 | D4     |
| Ring6 | D23    |
| Ring7 | D2     |

**MUX**

| Slice       | MUX PINS      |     |
| ----------- | ------------- | --- |
| Slice 0-15  | MUX 0, C0-C15 |     |
| Slice 16-31 | MUX 1, C0-C15 |     |

| MUX PINS | MCU IO | TYPE   |
| -------- | ------ | ------ |
| S0       | D26    | OUTPUT |
| S1       | D25    | OUTPUT |
| S2       | D33    | OUTPUT |
| S3       | D32    | OUTPUT |
| EN0      | D14    | OUTPUT |
| EN1      | D27    | OUTPUT |
| **SIG**  | VP     | INPUT  |

**LED**

| PINS    | MCU IO |     |
| ------- | ------ | --- |
| LED DIN | D13    |     |


