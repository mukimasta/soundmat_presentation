# 15 · Software challenge — 树莓派性能 (`15-software-challenge`)

- **时长**：约 40–50 秒（单页，按 Problem → Cause → Fix → Result 讲）
- **上接**：`14-software-bento`
- **下接**：`15-software-codebase` → `15-spine-sound`
- **依据**：`docs/SoundMat (16)  软件部署性能优化.md`

## 屏上结构

1. **顶栏主题句**：Works on Mac — crackling, laggy playback on the Pi  
2. **流程条**：Problem → Cause → Fix → Result  
3. **四列卡**：与文档 A–E 节对齐的要点 + 右侧 CPU 数字

## 讲稿（按四步）

**主题（指顶栏）**  
同一套 Jam、50 颗石头：**Mac 上很顺**，搬到 **Pi 3B** 上就变成 **卡顿、爆音、XRun 刷屏**，基本没法听。

**1 · Problem**  
不是「Pi 弱」这么简单——是**同一程序、两种机器**：笔记本有 5–10 倍余量；装置上 **scsynth 顶满 99.9%**，主循环也 90% 左右。

**2 · Cause**  
负载跟石头数涨：每颗石头一路 SuperCollider 音色，还带**一整份混响**（50 路）；扫描和 LED 按**整垫**算，不是只算有石头的区；200 Hz 主循环里 **LED 合成**后来 profiler 看占了大头。

**3 · Fix**（不念文件名，只讲层次）  
- 主循环 **200→60 Hz**，扫描/LED **倒排索引**（只碰有石头的扇区和灯）  
- 混响改成 **send/return 一条总线**，单 voice CPU **−45%**  
- **复音上限 12** + 偷最老 voice  
- **cProfile** 后 LED **60→30 Hz** 节流；音色逐字节对照，**听感不变**  
（口播可补：Pi 本机开 mat 页还有 Pi mode 降帧，远程访问无影响。）

**4 · Result**  
50 颗实测：**scsynth 99.9%→79%**，**jam loop 90%→60%**；爆音从一直在变成少见。**50 颗能在装置上稳定演。**

## 过渡

「算力留住了——下一页看这套软件有多大，再进声音化。」
