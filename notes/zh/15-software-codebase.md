# 15b · 代码库规模 (`15-software-codebase`)

- **时长**：约 20 秒
- **上接**：`15-software-challenge`（Result）
- **下接**：`15-spine-sound`

## 屏上

- **Software** · *The SoundMat codebase*
- 左：仓库目录树（manifest / sc / soundmat / tests …）
- 右：**5000+** lines of code + 技术栈标签

## 讲稿

性能优化是在这整个仓库上做的——**五千多行**量级：左边是结构。**manifest** 里是 Ambient 和 Jam 的 TOML/YAML 曲谱数据；**sc** 是 SuperCollider 的 SynthDef 和编译产物；**soundmat** 是 Python——读传感器、跑 Jam/Ambient、Web 控制台；**deploy/pi** 和 **scripts** 负责上板。不是一个小脚本，是一套完整装置软件。
