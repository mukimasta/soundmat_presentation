
根据 [[SoundMat (6)  电子系统设计]]，接下来我们完成电子系统的制造。宏观角度有三种方案：

| 方案    | 面包板（Breadboard） | 洞洞板（Perfboard） | PCB              |
| ----- | --------------- | -------------- | ---------------- |
| 连接方式  | 插接，无需焊接         | 焊接，手工飞线        | 蚀刻/印刷铜走线，焊接元件    |
| 可靠性   | 极差，接触不良频发，振动易松脱 | 好，焊点牢固         | 最好，工业级连接         |
| 适合阶段  | 早期验证电路原理        | Prototype 制作   | 量产或高要求 Prototype |
| 制作时间  | 几分钟             | 几小时            | 设计+打样周期 1-2 周    |
| 迭代灵活性 | 最高，随时改线         | 中等，改线需要拆焊      | 低，改设计要重新打板       |
| 成本    | 低               | 低              | 高（小批量打样费 + 等待时间） |
| 长时间运行 | 不可靠，公共场景不可接受    | 可靠             | 最可靠              |
| 采用    | ❌               | ✅              | ❌                |

在传感器制造完成之后，我们先快速用面包板验证传感器效果。后续采用洞洞板方案。

## 电路布局规划

对于已经有引脚的模块或者芯片，我们统一用 DIP Sockets 或者 Female Pin Header。

![[Pasted image 20260516015119.png | 400]]
![[Pasted image 20260516015053.png | 400]]


Rref 用了10kO可调电阻。


引脚对应

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




## 电源模块


### PD 诱骗模块调试

模块链接 1： https://www.amazon.com/gp/product/B0F1YH9P4X/
这个模块不能用，无论怎么调整都只能输出 5V 电压

模块链接 2： https://www.amazon.com/dp/B0D7942HWP?ref=ppx_yo2ov_dt_b_fed_asin_title&th=1
一次成功，小米充电器，小米充电宝均能输出 20V 电压


### 降压模块调试

![[FF06531F-3670-4B29-BBBE-F53C8D428439_1_105_c.jpeg | 300]]
![[19F53ACB-4C88-4019-B97E-1F0AAED3593F_1_105_c.jpeg | 300]]
![[948ED307-C543-45EB-B3D2-FBA04DA7BBD0_1_105_c.jpeg | 300]]
模块链接： https://www.amazon.com/gp/product/B0GLM6JQ3X/ ，$15.99.

目标是将 20V 降压至 5V。先接入实验室电源，设置 20V 1A，调节输出电压旋钮至显示输出 5V 电压。

接着调整最大保护电流，起初使用万用表电流档接入输出正负极调整保护电流，发现不可行，模块会不断重启。后续直接用导线短接输出正负极（没错就是这么吓人，但是这个模块确实就是这么做，没问题），调整最大保护电流至 7A。



### 树莓派电源

一开始我们尝试剪断一根 Micro USB 线，试图将里面的电源线和降压模块输出的电源线焊接在一起，发现非常不可靠且麻烦，因为 Micro USB 里面的电源线只有 28 AWG，太细了，稍微一扯就断了。

于是还是买了 Micro USB 转接板（Micro USB Breakout Board）。
链接： https://www.amazon.com/dp/B0F4KP6MB9?ref=ppx_yo2ov_dt_b_fed_asin_title


### LED 电源连接板

![[Pasted image 20260516015206.png | 400]]


手焊的





实测仅 LED 108颗灯珠全亮，功率为 5V 3.5 A。（May 29）

