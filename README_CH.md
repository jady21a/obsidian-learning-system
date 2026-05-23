# Learning System

把 Obsidian 笔记，转化为可复习的长期学习系统。

> 🌍 **English README**: [View English version](README.md)

---

## 为什么需要 Learning System？

你在 Obsidian 里写了很多笔记，但后来发现：

- 大部分内容很快就忘了  
- 笔记几乎不会被再次回顾  

**Learning System** 的目标，是把「记笔记」这件事，  
升级为一个**可持续运转的主动学习系统**。

---

## 核心理念

📥 **采集（Capture）**  
从笔记中提取真正有价值、值得记忆的内容  

🧠 **加工（Process）**  
自动生成问答卡（QA）/ 完形填空卡（Cloze）  

🔄 **复习（Review）**  
基于真实学习行为触发的复习流程与提醒  

📊 **分析（Analyze）**  
用数据反馈你的学习投入与复习情况  

---

## 功能概览

### 内容提取
- 支持从选中文本 / 当前文件 / 整个库提取
- 支持批量提取与表格提取
- 多种卡片类型：文本 / QA / Cloze

### 批注系统 
- 为提取内容添加个人理解与思考
- 支持快捷键快速编辑

### 复习系统
- 基于间隔重复理念的复习流程
- 键盘驱动的高效复习界面
- 根据学习行为触发复习提醒

### 学习分析
- 复习进度统计
- 学习行为数据反馈
- 支持按文件 / 标签 / 日期筛选

---

## 里程碑

所有功能从一开始就可用,没有等级门禁。使用过程中你会逐步达成各种**里程碑**(成就):

- 🌱 首次提取 · 📊 访问统计页
- 📄 提取为文本 ×5 · ❓ 提取为问答 ×5 · ⬛ 提取为挖空 ×5 · 🔍 扫描 10 篇笔记
- 📦 累计提取 30 张卡 · 📝 完成 10 条批注 · 📋 扫描 5 个表格 · 🔥 连续学习 7 天
- 🔄 复习 50 张卡 · 📅 累计学习 21 天
- 🎯 复习 150 张卡

每达成一项里程碑会弹一次祝贺通知。运行命令 **Learning System: Show milestones**
可随时查看完整清单与进度。


---


## 安装方式

**社区插件市场**(审核通过后):设置 → **Community Plugins → Browse** → 搜索 **Learning System** → 安装并启用。

**手动安装**(现在即可):从 [GitHub Releases](https://github.com/jady21a/obsidian-learning-system/releases) 下载 `manifest.json`、`main.js`、`styles.css`,放到 `.obsidian/plugins/learning-system/`,再到设置里启用。

> 社区市场上架正在审核中;在此之前请用上面的手动安装(或 BRAT)。

---

## 实验性功能:思维导图

内置一个**默认关闭**的「思维导图」功能。可在
**设置 → Learning System → Experimental → Mindmap** 开启。开启后可把笔记或选区
打开成可编辑的思维导图,并以思维导图形式复习挖空卡。

> 注意:从思维导图挖空会向笔记写入 block id(`^id`)。该功能仍在迭代,
> 想要稳定工作流可保持关闭。

---

## 使用方式
1. 命令列表打开侧边栏 Learning System: Open Learning  Overview(Sidebar)
2. 提取笔记并生成闪卡(可添加批注)
3. Learning System: Toggle Learning  Overview(Main View)可以查看所有提取的笔记
4. 开始复习(Start reviewing)
5. 查看统计

---
## 快捷键
批注编辑
-  `Tab` —— 保存批注

复习
* `Tab` —— 前进
* `Shift + Tab` —— 后退
* `1` —— Again
* `2` —— Hard
* `3` —— Good
* `4` —— Easy


## 开发路线图

### 计划中的功能
- [ ] **智囊团 / 社区学习系统**  
  👉 [了解更多](https://jz-quartz.pages.dev/6.about/%E6%99%BA%E5%9B%8A%E5%9B%A2)
- [x] mindmap 式复习 *(已实现为实验性功能,在设置中开启)*
- [ ] 移动端体验优化

---

## 隐私与数据  
所有数据均存储在本地，仅用于插件功能本身。

---

## 支持与反馈

- 欢迎通过 GitHub Issue 提交问题或建议
- 使用反馈对插件的发展非常重要 🙌

---

## License

MIT License  
详见 [LICENSE](LICENSE)
