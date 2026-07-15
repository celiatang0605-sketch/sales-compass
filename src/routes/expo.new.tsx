import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Save,
  Check,
  Mic,
  CreditCard,
  Camera,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/salesup/AppShell";
import { addDays, todayKey } from "@/lib/salesup/date";
import {
  PRIORITY_LABEL,
  type ExpoPriority,
} from "@/lib/salesup/expoMock";
import {
  clearDraft,
  getDraft,
  saveDraft,
  searchCompanies,
  type ExpoDraft,
} from "@/lib/salesup/expoStore";
import { createLead, listLeads, listUserCompanies } from "@/lib/salesup/expoRepository";
import { useExpoLeads } from "@/lib/salesup/useExpoLeads";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expo/new")({
  head: () => ({ meta: [{ title: "快速记录 · 展会线索" }] }),
  component: ExpoNewPage,
});

const PRIORITIES: ExpoPriority[] = ["A", "B", "C", "D", "unrated"];

const SIGNAL_OPTIONS = [
  "有明确需求",
  "有具体项目",
  "愿意继续聊",
  "需要发资料",
  "已约下一步",
  "有关键决策人",
  "暂时无需求",
];

const NEXT_ACTIONS = [
  "加微信",
  "发公司介绍",
  "发案例",
  "发方案",
  "约 Demo",
  "约下一次会议",
  "二次拜访",
  "补充客户研究",
  "暂无",
];

function offsetDate(days: number): string {
  return addDays(todayKey(), days);
}

const emptyForm = () => ({
  company: "",
  raw: "",
  priority: "unrated" as ExpoPriority,
  signals: [] as string[],
  nextAction: "",
  nextDate: "",
});

function ExpoNewPage() {
  const navigate = useNavigate();
  const { userId, leads, refresh } = useExpoLeads();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<null | "back" | "again" | "later">(null);
  const [draftPrompt, setDraftPrompt] = useState<ExpoDraft | null>(null);
  const [companyFocus, setCompanyFocus] = useState(false);
  const [historyCompanies, setHistoryCompanies] = useState<string[]>([]);
  const companyRef = useRef<HTMLInputElement>(null);
  const draftInitRef = useRef(false);

  // Draft prompt + history companies — after we know the user.
  useEffect(() => {
    if (!userId) return;
    if (!draftInitRef.current) {
      draftInitRef.current = true;
      const d = getDraft(userId);
      if (d) setDraftPrompt(d);
    }
    listUserCompanies().then(setHistoryCompanies).catch(() => {});
  }, [userId]);

  // Debounced draft persist (scoped to current user).
  useEffect(() => {
    const t = setTimeout(() => {
      const isEmpty =
        !form.company.trim() &&
        !form.raw.trim() &&
        !form.nextAction.trim() &&
        form.signals.length === 0 &&
        form.priority === "unrated";
      if (isEmpty) return;
      const d: ExpoDraft = { ...form, updatedAt: Date.now() };
      saveDraft(userId, d);
    }, 400);
    return () => clearTimeout(t);
  }, [form, userId]);

  const suggestions = useMemo(() => {
    if (!companyFocus) return [];
    return searchCompanies(form.company, historyCompanies);
  }, [form.company, companyFocus, historyCompanies]);

  const canSave = form.company.trim().length > 0 || form.raw.trim().length > 0;

  // Today counts from actual Supabase data.
  const today = todayKey();
  const counts = useMemo(() => {
    const todays = leads.filter((l) => l.createdAt === today);
    return {
      total: todays.length,
      A: todays.filter((l) => l.priority === "A").length,
      toOrganize: todays.filter((l) => l.status === "to_organize").length,
    };
  }, [leads, today]);

  const patch = useCallback(
    (partial: Partial<typeof form>) => setForm((f) => ({ ...f, ...partial })),
    [],
  );

  const toggleSignal = (s: string) => {
    setForm((f) => ({
      ...f,
      signals: f.signals.includes(s) ? f.signals.filter((x) => x !== s) : [...f.signals, s],
    }));
  };

  const doSave = async (mode: "back" | "again" | "later") => {
    if (!canSave || saving) return;
    if (!userId) {
      toast.error("请先登录再保存线索");
      navigate({ to: "/auth" });
      return;
    }
    const isLater = mode === "later";
    setSaving(true);
    try {
      await createLead({
        company: form.company,
        rawNote: form.raw,
        priority: isLater ? "unrated" : form.priority,
        status: isLater ? "to_organize" : "to_follow_up",
        signals: form.signals,
        nextAction: isLater ? "" : form.nextAction,
        nextActionDate: form.nextDate,
      });
      clearDraft(userId);
      // Refresh list so the index/status bar reflects the new lead.
      void refresh().catch(() => void listLeads());

      const label = form.company.trim() || "匿名线索";
      toast.success(`已记录 · ${label}`);
      setSavedFlash(mode);

      if (mode === "back") {
        setTimeout(() => navigate({ to: "/expo" }), 350);
        return;
      }
      setTimeout(() => {
        setForm(emptyForm());
        setSavedFlash(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        companyRef.current?.focus();
      }, 350);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败，请重试";
      toast.error("保存失败", { description: msg });
      // Intentionally do NOT clear form or draft on failure.
    } finally {
      setSaving(false);
    }
  };

  const applyDraft = () => {
    if (!draftPrompt) return;
    setForm({
      company: draftPrompt.company ?? "",
      raw: draftPrompt.raw ?? "",
      priority: draftPrompt.priority ?? "unrated",
      signals: draftPrompt.signals ?? [],
      nextAction: draftPrompt.nextAction ?? "",
      nextDate: draftPrompt.nextDate ?? todayIso(),
    });
    setDraftPrompt(null);
  };

  const discardDraft = () => {
    clearDraft(userId);
    setDraftPrompt(null);
  };

  const stub = () => toast("功能将在下一阶段开放");

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto pb-40 md:pb-8">
        <div className="flex items-center gap-2 mb-3">
          <Link
            to="/expo"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>

        <div className="mb-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground/80 font-medium">今日已记录 {counts.total} 条</span>
          <span className="text-muted-foreground/70">·</span>
          <span>A {counts.A}</span>
          <span className="text-muted-foreground/70">·</span>
          <span>待整理 {counts.toOrganize}</span>
        </div>

        {draftPrompt && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-amber-800">发现一条未完成记录</div>
              <div className="text-xs text-amber-700/80 truncate mt-0.5">
                {draftPrompt.company || draftPrompt.raw || "(空标题)"}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={applyDraft}
                className="h-8 px-3 rounded-md bg-amber-600 text-white text-xs font-medium"
              >
                继续填写
              </button>
              <button
                onClick={discardDraft}
                className="h-8 px-2 rounded-md text-amber-800 text-xs hover:bg-amber-500/10"
                aria-label="放弃草稿"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">快速记录</h1>
          <p className="text-xs text-muted-foreground mt-1">
            现场先把关键信息落下来，回去再补齐。
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <Field label="公司 / 线索名称">
            <div className="relative">
              <input
                ref={companyRef}
                value={form.company}
                onChange={(e) => patch({ company: e.target.value })}
                onFocus={() => setCompanyFocus(true)}
                onBlur={() => setTimeout(() => setCompanyFocus(false), 120)}
                placeholder="例如：星海传媒集团"
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                autoFocus
              />
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 left-0 right-0 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        patch({ company: s });
                        setCompanyFocus(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="原始现场记录" hint="现场简讯 / 关键词">
            <textarea
              value={form.raw}
              onChange={(e) => patch({ raw: e.target.value })}
              placeholder="直接记录刚刚聊了什么：对方是谁、负责什么、有什么问题、对什么感兴趣、答应了什么、下一步做什么……"
              rows={8}
              className="w-full min-h-[200px] px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 leading-relaxed"
            />
            <div className="mt-2 flex gap-1.5 flex-wrap">
              <QuickIcon icon={Mic} label="语音记录" onClick={stub} />
              <QuickIcon icon={CreditCard} label="拍名片" onClick={stub} />
              <QuickIcon icon={Camera} label="拍照片" onClick={stub} />
            </div>
          </Field>

          <Field label="客户价值">
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map((r) => {
                const active = r === form.priority;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => patch({ priority: r })}
                    className={cn(
                      "px-3 min-h-9 rounded-full border text-xs transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {PRIORITY_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="现场信号" hint="可多选">
            <div className="flex gap-1.5 flex-wrap">
              {SIGNAL_OPTIONS.map((s) => {
                const active = form.signals.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSignal(s)}
                    className={cn(
                      "px-3 min-h-9 rounded-full border text-xs transition",
                      active
                        ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/40"
                        : "bg-background text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="下一步动作">
            <div className="flex gap-1.5 flex-wrap mb-2">
              {NEXT_ACTIONS.map((a) => {
                const active = form.nextAction === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => patch({ nextAction: a })}
                    className={cn(
                      "px-3 min-h-9 rounded-full border text-xs transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <input
              value={form.nextAction}
              onChange={(e) => patch({ nextAction: e.target.value })}
              placeholder="或自己写：例如 周三前发方案"
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </Field>

          <Field label="下一步日期">
            <div className="flex gap-1.5 flex-wrap mb-2">
              {[
                { label: "今天", v: offsetDate(0) },
                { label: "明天", v: offsetDate(1) },
                { label: "3 天后", v: offsetDate(3) },
                { label: "1 周后", v: offsetDate(7) },
              ].map((q) => {
                const active = form.nextDate === q.v;
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => patch({ nextDate: q.v })}
                    className={cn(
                      "px-3 min-h-9 rounded-full border text-xs transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={form.nextDate}
              onChange={(e) => patch({ nextDate: e.target.value })}
              className="w-full md:w-52 h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </Field>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => void doSave("later")}
              disabled={!canSave || saving}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-40"
            >
              先记下来，稍后整理
            </button>
          </div>
        </div>

        {/* Desktop action bar */}
        <div className="hidden md:flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => void doSave("back")}
            disabled={!canSave || saving}
            className="h-10 px-4 rounded-lg border border-border text-sm hover:bg-secondary disabled:opacity-50"
          >
            保存并返回
          </button>
          <button
            onClick={() => void doSave("again")}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedFlash === "again" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "保存中…" : "保存并继续下一家"}
          </button>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur px-3 py-2.5 flex gap-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <button
          onClick={() => void doSave("back")}
          disabled={!canSave || saving}
          className="flex-1 h-11 rounded-lg border border-border text-sm bg-background disabled:opacity-50"
        >
          保存并返回
        </button>
        <button
          onClick={() => void doSave("again")}
          disabled={!canSave || saving}
          className="flex-[1.4] inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : savedFlash === "again" ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "保存中…" : "保存并继续下一家"}
        </button>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function QuickIcon({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 bg-background"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
