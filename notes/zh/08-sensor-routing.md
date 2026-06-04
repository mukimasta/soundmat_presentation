# 08b · SENSOR FABRICATION — 走线 (`08-sensor-routing`)

- **时长**：约 45 秒
- **操作**：进页后 **SPACE ×2**（共 3 拍）
- **上接**：08 层叠结构
- **下接**：Electronics spine

| 拍 | 标题 | 图 |
|----|------|-----|
| 0 | Ring tails | `fab-ring-tails.png` |
| 1 | Copper tape | `fab-copper-tape.png` |
| 2 | Board holes | `fab-board-holes.png` |

## 讲稿

### 拍 0 · 尾巴

切割时每个**同心圆环**带**尾巴**，导电布穿过木板**对应孔洞**，接到下面空腔里的电路。

### 拍 1 · 铜箔胶带

**扇区**上用**铜箔胶带**从边缘**弯折到板下**，既接线又压住上层传感器。

### 拍 2 · 木板打孔

木板沿径向**打孔**，与每条环的尾巴对齐，引线进空腔；扇区不必逐个穿孔。

## 过渡

「走线清楚之后，下一页看 Python 设计工具怎么生成激光刀路。」→ `08-sensor-design-tool` → `08-sensor-laser-patterns`
