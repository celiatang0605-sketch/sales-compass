# Phase 3 已完成 · 展会线索接入 Supabase

## 关键变化

- **字段统一**：`rating` → `priority`；`status` 使用新的 9 值 union（`to_organize` / `to_follow_up` / `contacted` / `waiting_reply` / `replied` / `meeting_scheduled` / `converted` / `nurture` / `invalid`）。
- **正式数据源**：`expo_leads` 表，按 `auth.uid()` 做 RLS。
- **本地存储用途缩减**：
  - `salesup.expo.new.draft.v1:<userId>` — 未提交草稿（按账号隔离）。
  - `salesup.expo.leads.v1` — 只作为 Phase 2 遗留数据检测，一次性迁移后清空。
  - `salesup.expo.legacy.migrated.v1:<userId>` — 迁移完成标记。
- **MOCK_LEADS 移除**，改为轻量 `MOCK_COMPANY_POOL`，仅供 autocomplete 兜底。

## 数据库

SQL 位于 `db/expo_leads.sql`。请在 Supabase Dashboard → SQL Editor 手动执行一次（可重复执行）。包含：

- `public.expo_leads` 表 + 默认值 + CHECK 约束
- `GRANT` 给 `authenticated` / `service_role`
- 4 条 RLS policy（select / insert / update / delete，均 `auth.uid() = user_id`）
- 索引：`(user_id, created_at desc)` / `(user_id, status)` / `(user_id, priority)` / `(user_id, next_action_date)`
- `updated_at` 自动更新 trigger

## 新增/修改文件

新增：

- `db/expo_leads.sql`
- `src/lib/salesup/expoRepository.ts` — `listLeads` / `getLead` / `createLead` / `updateLead` / `deleteLead` / `listUserCompanies`
- `src/lib/salesup/useExpoLeads.ts` — 订阅 auth 状态，拉取 leads，暴露 loading / error / refresh

改写：

- `src/lib/salesup/expoMock.ts` — 只保留类型 + label + 公司自动补全池
- `src/lib/salesup/expoStore.ts` — 只负责草稿（按用户 scope） + Phase 2 遗留数据迁移工具
- `src/routes/expo.index.tsx` — 走 Supabase，含 loading / error / empty / 未登录 / 遗留迁移条
- `src/routes/expo.$id.tsx` — 走 Supabase，独立 loading / error / not-found
- `src/routes/expo.new.tsx` — 保存改成 async Supabase 调用，失败保留表单/草稿，成功后刷新列表并保持"连续记录"节奏

## 保存流程

1. 校验最低必填：公司或原始记录任一非空。
2. 未登录 → 提示并跳 `/auth`。
3. 成功：`clearDraft(userId)` → toast → `refresh()` → 「保存并继续」清空表单聚焦公司框；「保存并返回」跳回 `/expo`。
4. 失败：toast 错误 → 表单和草稿都保留 → 按钮恢复可点。

## 遗留数据迁移

登录后若检测到 `salesup.expo.leads.v1` 里有记录且当前账号未标记迁移，`/expo` 顶部展示提示条：

- 点「导入到当前账号」：逐条 `createLead` → 全部成功则清空本地键；失败条数会 toast 显示；无论成败都写入迁移标记，避免重复。
- 点「稍后」：仅隐藏本次显示，下次登录仍可看到。

## 后续（不在本阶段做）

- 详情页编辑 / 状态推进 UI（`updateLead` 已就绪）
- 删除操作 UI
- 附件（名片 / 现场照片）→ Supabase Storage
- AI 整理、语音、OCR
