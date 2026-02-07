# Mini-QuestionBank (微信小程序动态题库)

![Platform](https://img.shields.io/badge/Platform-WeChat-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Language](https://img.shields.io/badge/Language-JavaScript-yellow)
![Downloads](https://img.shields.io/github/downloads/gzjjjfree/Mini-QuestionBank/total?style=flat-square&color=orange)

一个基于微信小程序的轻量级、响应式题库管理与练习系统。支持多种题型自定义、Excel/TXT/JSON 导入、以及智能数据排序与冲突处理。


## 🚀 核心功能

- **多题型支持**：完美适配填空题、单选题、多选题、判断题及问答题。
- **智能导入机制**：支持 Excel/TXT/JSON 文件导入，内置重名检测逻辑。
- **导出 JSON**：仅支持导出为JSON 文件。
- **动态编辑系统**：
  - 支持在当前题型实时修正或新增题目。
  - 自动 ID 重排与题型权重排序（填空 > 单选 > 多选...）。
  - 判断题、问答题专属布局优化（左对齐渲染）。
- **持久化存储**：基于本地 Storage 的数据持久化，支持按时间戳倒序管理历史文件。
- **交互体验**：
  - 答题进度自动保存，支持题目平移删除（删除题目后答案自动对齐）。
  - 丝滑的 UI 反馈，完善的 Loading 与 Toast 状态管理。

## 🛠 技术栈

- **框架**：原生微信小程序 (WXML, WXSS, JavaScript)
- **存储**：微信本地缓存 (wx.getStorageSync / wx.setStorageSync)

## 📂 项目结构

```text
├── pages/
│   ├── index/          # 文件列表与导入页
│   └── practice/       # 刷题与编辑主页面
├── utils/
│   ├── storage.js      # 存储管理逻辑 (排序、读取)
│   └── excel-parser.js # 文件解析与重组逻辑
└── app.js              # 全局数据管理
```

## 📝 快速开始

1. **克隆项目**
2. [https://github.com/gzjjjfree/Mini-QuestionBank.git](https://github.com/gzjjjfree/Mini-QuestionBank.git)
   ```bash
   git clone https://github.com/gzjjjfree/Mini-QuestionBank.git
   ```

3. **导入开发者工具**
   打开微信开发者工具，选择“导入项目”，选择本项目根目录。

4. **配置权限**
   确保在开发者工具中开启了“将 JS 编译成ES5”。

## 🔧 使用提示

- **新增题目**：在练习界面点击“新增”，选择题型后，系统会自动根据题型初始化选项（如判断题自动生成“正确/错误”）。
- **数据恢复**：删除题目时，系统会自动平移后续题目索引，确保已做的笔记和答案不会错位。

## 🤝 贡献

欢迎提交 **[Pull Request](https://github.com/gzjjjfree/Mini-QuestionBank/pulls)** 或 **[Issue](https://github.com/gzjjjfree/Mini-QuestionBank/issues)** 来完善本项目！

---
感谢Gemini的帮助！Made with ❤️ by Gemini

---