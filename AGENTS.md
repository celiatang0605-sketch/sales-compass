<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## 项目开发规范

- 开发规范见 CLAUDE.md（仓库内实际文件名为 `CLAUDE.md — Sales Up（销售个人工作台）`），每次开始工作前必须先读；客户看板模块的设计决策见 `docs/customer-board-spec.md`。
- 只做浅色模式，不写任何 `dark:` class。
- 不硬编码颜色，只使用 `src/styles.css` 中定义的 CSS 变量。
- 项目使用 TanStack Start SSR；访问 `window` / `localStorage` 必须先守卫 `typeof window === "undefined"`。
- 使用文件式路由，不手动修改 `routeTree.gen.ts`。
- 数据层严格遵循 `expoRepository.ts` + `useLeads.ts` 的 repository / hook 分层，不在组件里直接调用 Supabase。
- 所有统计数字从 `time_blocks` 经 `stats.ts` 的 `computeStats` 实时聚合，不得复制聚合逻辑。
- 使用外部 Supabase，而非 Lovable Cloud；表结构变更写入 `db/*.sql`，由人工在 Dashboard 执行。
- 界面使用中文，以 `text-xs` / `text-sm` 为主。

## 验证命令

- 类型检查：`npx tsc --noEmit`。不要使用 `bunx tsgo`；它未在 `package.json` 中声明，依赖联网下载，可能不可用。
- Lint：`npm run lint`。
- 仓库锁文件：`bun.lock`。
