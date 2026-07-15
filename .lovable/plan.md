## 第二阶段：/expo/new 快速记录页优化

目标：现场 30–60 秒完成一条记录，立即继续下一家。本阶段仍不接 Supabase，全部使用 localStorage 作为临时数据层。

---

### 1. 新增本地数据层 `src/lib/salesup/expoStore.ts`

一个轻量前端存储层，配合现有 mock 数据一起显示。

- `LS_KEY_LEADS = "salesup.expo.leads.v1"` — 用户本轮新增的线索
- `LS_KEY_DRAFT = "salesup.expo.new.draft.v1"` — 未提交草稿
- 导出：
  - `getUserLeads()` / `addUserLead(lead)` — 读写用户新增线索
  - `getAllLeads()` — 合并 `MOCK_LEADS` 与用户新增，按 `createdAt` 倒序
  - `getDraft()` / `saveDraft(partial)` / `clearDraft()` — 草稿读写
  - `todayCounts()` — 返回 `{ total, A, toOrganize }`（合并数据源）
- 在文件顶部注释标记「Phase 2 临时实现，Phase 3 迁移到 Supabase」。

`/expo` 首页 (`expo.index.tsx`) 与详情页 (`expo.$id.tsx`) 改为读取 `getAllLeads()` / 从合并列表 findLead，让新增线索能立即出现在列表并可点击进入详情。

### 2. 重构 `/expo/new` 页面

页面自上而下分成六个区块：

1. **顶部状态条（一行）**
   `今日已记录 8 条 · A 2 · 待整理 5` — 来自 `todayCounts()`。
2. **草稿恢复条**（仅当检测到未清除草稿且和当前空白表单不同时）
   浅色横条：`发现一条未完成记录 [继续填写] [放弃草稿]`。不自动覆盖当前输入。
3. **公司 / 线索名称**
   - 输入框 + 下方 autocomplete 面板（现场匹配 `MOCK_LEADS.company` + 一个内置模拟公司数组，只做前端匹配）。
   - 选择后自动填入。
4. **原始现场记录**
   - textarea，`rows={8}`，`min-h-[200px]`，新的引导性 placeholder。
   - 下方 3 个快捷入口按钮：`🎙 语音记录` / `📇 拍名片` / `📷 拍照片` — 点击后 sonner toast「功能将在下一阶段开放」，不打开 Modal。
5. **快速判断（标签点选，无下拉）**
   - **客户价值**（单选）：A 重点 / B 值得跟进 / C 普通线索 / D 暂不跟进 / 待判断
   - **现场信号**（多选）：有明确需求 / 有具体项目 / 愿意继续聊 / 需要发资料 / 已约下一步 / 有关键决策人 / 暂时无需求
6. **下一步**
   - 动作快捷按钮（点后填入输入框，可继续编辑）：加微信 / 发公司介绍 / 发案例 / 发方案 / 约 Demo / 约下一次会议 / 二次拜访 / 补充客户研究 / 暂无
   - 输入框（可自由改写）
   - 日期快捷：今天 / 明天 / 3 天后 / 1 周后，保留原生日期选择器

### 3. 保存流程

底部固定操作栏（手机+桌面同结构，桌面右对齐）：

- **主按钮**：`保存并继续下一家`
- **次按钮**：`保存并返回`
- **第三按钮**（左侧文字链接式）：`先记下来，稍后整理`

保存逻辑：
- **最低条件**：`公司名称 或 原始记录` 至少一个非空。否则按钮 disabled + 轻提示。
- 保存时构造 `ExpoLead`，写入 `addUserLead`，清除草稿。
- **保存并继续**：sonner toast `已记录 · <公司名或"匿名线索">`，清空全部字段，焦点回到公司输入框，`window.scrollTo(0,0)`。**不跳转、不弹确认框。**
- **保存并返回**：navigate `/expo`。
- **稍后整理**：强制 `rating="unrated"` + `status="to_organize"`，允许 `nextAction` 为空，其它按同样流程处理（默认走"保存并继续"行为）。

### 4. 草稿保护

- 每次输入变化（去抖 400ms）后写入 `LS_KEY_DRAFT`。
- 页面 mount 时：若草稿非空且当前表单为空 → 显示恢复条；不自动填。
- 「继续填写」→ 载入草稿到表单；「放弃草稿」→ `clearDraft()` 并隐藏。
- 成功保存后 `clearDraft()`。

### 5. 手机端适配 (390px 目标)

- textarea 至少 8 行；键盘弹出时底部按钮浮动可见（使用 `env(safe-area-inset-bottom)` + `pb` 已有模式）。
- 所有标签按钮 `min-h-9`，间距 `gap-1.5`，`flex-wrap` 而不是横向滚动，避免误触。
- 内容容器 `max-w-2xl mx-auto`，`pb-40`（给底栏 + 键盘留空间）。
- 无 Modal 嵌套：快捷入口只发 Toast，autocomplete 是内联下拉不是 Popover。
- 状态条、恢复条只占一行，粘性顶部不占空间。

### 6. 交付说明（保存后向你汇报）

- 修改文件：`src/routes/expo.new.tsx`（重写）、`src/routes/expo.index.tsx`（改数据源）、`src/routes/expo.$id.tsx`（改数据源）、新增 `src/lib/salesup/expoStore.ts`。
- localStorage keys：`salesup.expo.leads.v1`、`salesup.expo.new.draft.v1`。
- 最低必填：公司名称或原始记录任一非空。
- 「稍后整理」等同于强制 `unrated + to_organize`。
- Phase 3 需迁移到 Supabase 的部分：`expoStore.ts` 整个模块。
- 不改动：time_blocks、reminders、workTypes、现有时间轴逻辑，也不新增 Supabase 表。

完成后停止，等待你在 390px 预览下确认体验。