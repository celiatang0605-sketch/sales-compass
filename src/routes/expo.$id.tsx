import { createFileRoute, Link, notFound, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Phone,
  Mail,
  MessageCircle,
  Paperclip,
  Image as ImageIcon,
  CreditCard,
  Loader2,
  RefreshCw,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/salesup/AppShell";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  STATUS_LABEL,
  type ExpoLead,
  type ExpoPriority,
  type ExpoStatus,
} from "@/lib/salesup/expoMock";
import { getLead, updateLead, type UpdateLeadInput } from "@/lib/salesup/expoRepository";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expo/$id")({
  head: ({ params }) => ({ meta: [{ title: `线索详情 · ${params.id}` }] }),
  notFoundComponent: LeadNotFound,
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="py-16 text-center text-sm text-rose-700">
        {error instanceof Error ? error.message : "读取失败"}
      </div>
    </AppShell>
  ),
  component: ExpoDetailPage,
});

function LeadNotFound() {
  return (
    <AppShell>
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground mb-4">找不到这条线索</p>
        <Link to="/expo" className="text-sm text-primary hover:underline">
          返回列表
        </Link>
      </div>
    </AppShell>
  );
}

const PRIORITIES: ExpoPriority[] = ["A", "B", "C", "D", "unrated"];
const STATUSES: ExpoStatus[] = [
  "to_organize",
  "to_follow_up",
  "contacted",
  "waiting_reply",
  "replied",
  "meeting_scheduled",
  "converted",
  "nurture",
  "invalid",
];

const SIGNAL_OPTIONS = [
  "有明确需求",
  "有具体项目",
  "愿意继续聊",
  "需要发资料",
  "已约下一步",
  "有关键决策人",
  "暂时无需求",
];

interface FormState {
  company: string;
  industry: string;
  companyBackground: string;
  eventName: string;
  eventDate: string;
  hall: string;
  booth: string;
  contactName: string;
  contactTitle: string;
  phone: string;
  wechat: string;
  email: string;
  rawNote: string;
  summary: string;
  keyInfo: string;
  coreProblem: string;
  currentNeed: string;
  decisionRole: string;
  budgetSignal: string;
  timeline: string;
  currentVendor: string;
  priorityReason: string;
  priority: ExpoPriority;
  status: ExpoStatus;
  signals: string[];
  nextAction: string;
  nextActionDate: string;
  lastContactedAt: string;
}

function leadToForm(l: ExpoLead): FormState {
  return {
    company: l.company ?? "",
    industry: l.industry ?? "",
    companyBackground: l.companyBackground ?? "",
    eventName: l.eventName ?? "",
    eventDate: l.eventDate ?? "",
    hall: l.hall ?? "",
    booth: l.booth ?? "",
    contactName: l.contactName ?? "",
    contactTitle: l.contactTitle ?? "",
    phone: l.phone ?? "",
    wechat: l.wechat ?? "",
    email: l.email ?? "",
    rawNote: l.rawNote ?? "",
    summary: l.summary ?? "",
    keyInfo: l.keyInfo ?? "",
    coreProblem: l.coreProblem ?? "",
    currentNeed: l.currentNeed ?? "",
    decisionRole: l.decisionRole ?? "",
    budgetSignal: l.budgetSignal ?? "",
    timeline: l.timeline ?? "",
    currentVendor: l.currentVendor ?? "",
    priorityReason: l.priorityReason ?? "",
    priority: l.priority,
    status: l.status,
    signals: l.signals ?? [],
    nextAction: l.nextAction ?? "",
    nextActionDate: l.nextActionDate ?? "",
    lastContactedAt: l.lastContactedAt ?? "",
  };
}

function formEqual(a: FormState, b: FormState): boolean {
  const keys = Object.keys(a) as (keyof FormState)[];
  for (const k of keys) {
    if (k === "signals") {
      const s1 = a.signals ?? [];
      const s2 = b.signals ?? [];
      if (s1.length !== s2.length) return false;
      for (let i = 0; i < s1.length; i++) if (s1[i] !== s2[i]) return false;
    } else if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
}

function ExpoDetailPage() {
  const { id } = Route.useParams();
  const [lead, setLead] = useState<ExpoLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getLead(id)
      .then((l) => {
        setLead(l);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "读取失败");
        setLoading(false);
      });
  };

  useEffect(load, [id]);

  const dirty = useMemo(() => {
    if (!editing || !lead || !form) return false;
    return !formEqual(form, leadToForm(lead));
  }, [editing, lead, form]);

  // Warn on in-app navigation with unsaved edits.
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm("有尚未保存的修改，确认离开吗？");
    },
    enableBeforeUnload: () => dirty,
  });

  const startEdit = () => {
    if (!lead) return;
    setForm(leadToForm(lead));
    setEditing(true);
  };

  const cancelEdit = () => {
    if (dirty && !window.confirm("有尚未保存的修改，确认放弃吗？")) return;
    setEditing(false);
    setForm(null);
  };

  const patch = (p: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...p } : f));

  const toggleSignal = (s: string) => {
    setForm((f) => {
      if (!f) return f;
      return {
        ...f,
        signals: f.signals.includes(s)
          ? f.signals.filter((x) => x !== s)
          : [...f.signals, s],
      };
    });
  };

  const doSave = async () => {
    if (!form || saving) return;
    setSaving(true);
    try {
      const payload: UpdateLeadInput = { ...form };
      const updated = await updateLead(id, payload);
      setLead(updated);
      setEditing(false);
      setForm(null);
      toast.success("线索已更新");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败，请重试";
      toast.error("保存失败", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (p: UpdateLeadInput) => {
    if (!lead || quickBusy) return;
    const prev = lead;
    // optimistic
    setLead({ ...lead, ...p } as ExpoLead);
    setQuickBusy(true);
    try {
      const updated = await updateLead(id, p);
      setLead(updated);
      toast.success("已更新");
    } catch (e) {
      setLead(prev);
      const msg = e instanceof Error ? e.message : "更新失败";
      toast.error("更新失败", { description: msg });
    } finally {
      setQuickBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-16 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载线索…
        </div>
      </AppShell>
    );
  }
  if (error) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto py-12">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-800">
            <div className="font-medium">加载失败</div>
            <div className="text-xs mt-1 break-words">{error}</div>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-rose-600 text-white text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试
            </button>
          </div>
        </div>
      </AppShell>
    );
  }
  if (!lead) {
    throw notFound();
  }

  return (
    <AppShell>
      <div className={cn("max-w-3xl mx-auto", editing ? "pb-40 md:pb-8" : "pb-8")}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link
            to="/expo"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            返回列表
          </Link>
          {!editing ? (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-sm hover:bg-secondary"
            >
              <Pencil className="w-4 h-4" />
              编辑
            </button>
          ) : (
            <div className="text-xs text-muted-foreground">编辑模式</div>
          )}
        </div>

        {/* Header card with quick priority/status */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5 mb-3">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              {editing && form ? (
                <input
                  value={form.company}
                  onChange={(e) => patch({ company: e.target.value })}
                  placeholder="公司 / 线索名称"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-base font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              ) : (
                <>
                  <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate">
                    {lead.company || "(未命名线索)"}
                  </h1>
                  {lead.contactName && (
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {lead.contactName}
                      {lead.contactTitle ? ` · ${lead.contactTitle}` : ""}
                    </div>
                  )}
                </>
              )}
            </div>
            {!editing && (
              <div className="flex gap-1.5">
                <span
                  className={cn(
                    "px-2 h-6 inline-flex items-center rounded border text-xs",
                    PRIORITY_STYLE[lead.priority],
                  )}
                >
                  {PRIORITY_LABEL[lead.priority]}
                </span>
                <span className="px-2 h-6 inline-flex items-center rounded bg-secondary text-secondary-foreground text-xs">
                  {STATUS_LABEL[lead.status]}
                </span>
              </div>
            )}
          </div>

          {/* Quick priority/status controls (read mode only) */}
          {!editing && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  优先级
                </div>
                <div className="flex gap-1 flex-wrap">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      disabled={quickBusy}
                      onClick={() =>
                        p !== lead.priority && void quickUpdate({ priority: p })
                      }
                      className={cn(
                        "px-2.5 min-h-8 rounded-full border text-xs transition disabled:opacity-60",
                        p === lead.priority
                          ? PRIORITY_STYLE[p]
                          : "bg-background text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  状态
                </div>
                <select
                  disabled={quickBusy}
                  value={lead.status}
                  onChange={(e) =>
                    void quickUpdate({ status: e.target.value as ExpoStatus })
                  }
                  className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!editing && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 text-sm">
              <InfoRow label="下一步动作" value={lead.nextAction} />
              <div className="hidden md:block w-px bg-border" />
              <InfoRow label="下一步日期" value={lead.nextActionDate} />
            </div>
          )}
        </div>

        {/* Basic info (展会 + 公司) */}
        <Section title="基础信息">
          {editing && form ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <EditInput label="行业" value={form.industry} onChange={(v) => patch({ industry: v })} />
              <EditInput label="展会名称" value={form.eventName} onChange={(v) => patch({ eventName: v })} />
              <EditInput label="展会日期" type="date" value={form.eventDate} onChange={(v) => patch({ eventDate: v })} />
              <EditInput label="展馆" value={form.hall} onChange={(v) => patch({ hall: v })} />
              <EditInput label="展位" value={form.booth} onChange={(v) => patch({ booth: v })} />
              <EditTextarea label="公司背景" value={form.companyBackground} onChange={(v) => patch({ companyBackground: v })} className="md:col-span-2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
              <InfoRow label="行业" value={lead.industry} />
              <InfoRow label="展会名称" value={lead.eventName} />
              <InfoRow label="展会日期" value={lead.eventDate} />
              <InfoRow label="展馆" value={lead.hall} />
              <InfoRow label="展位" value={lead.booth} />
              <InfoRow label="公司背景" value={lead.companyBackground} multiline />
            </div>
          )}
        </Section>

        <Section title="原始记录">
          {editing && form ? (
            <textarea
              value={form.rawNote}
              onChange={(e) => patch({ rawNote: e.target.value })}
              rows={8}
              placeholder="现场简讯、关键词、追加的补充……"
              className="w-full min-h-[180px] px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 leading-relaxed"
            />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {lead.rawNote || <span className="text-muted-foreground">现场未记录</span>}
            </p>
          )}
        </Section>

        <Section title="现场信号" hint="可多选">
          {editing && form ? (
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
          ) : lead.signals && lead.signals.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap">
              {lead.signals.map((s) => (
                <span
                  key={s}
                  className="px-2 h-6 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">无</div>
          )}
        </Section>

        <Section title="联系人">
          {editing && form ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <EditInput label="姓名" value={form.contactName} onChange={(v) => patch({ contactName: v })} />
              <EditInput label="职位" value={form.contactTitle} onChange={(v) => patch({ contactTitle: v })} />
              <EditInput label="手机" value={form.phone} onChange={(v) => patch({ phone: v })} inputMode="tel" />
              <EditInput label="微信" value={form.wechat} onChange={(v) => patch({ wechat: v })} />
              <EditInput label="邮箱" value={form.email} onChange={(v) => patch({ email: v })} type="email" className="md:col-span-2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
              <InfoRow label="姓名" value={lead.contactName} />
              <InfoRow label="职位" value={lead.contactTitle} />
              <InfoRow label="手机" value={lead.phone} icon={Phone} />
              <InfoRow label="微信" value={lead.wechat} icon={MessageCircle} />
              <InfoRow label="邮箱" value={lead.email} icon={Mail} />
            </div>
          )}
        </Section>

        <Section title="现场沟通">
          {editing && form ? (
            <div className="space-y-3">
              <EditTextarea label="沟通摘要" value={form.summary} onChange={(v) => patch({ summary: v })} />
              <EditTextarea label="关键信息" value={form.keyInfo} onChange={(v) => patch({ keyInfo: v })} />
              <EditTextarea label="核心问题" value={form.coreProblem} onChange={(v) => patch({ coreProblem: v })} />
              <EditTextarea label="当前需求" value={form.currentNeed} onChange={(v) => patch({ currentNeed: v })} />
            </div>
          ) : (
            <div className="space-y-2">
              <InfoRow label="沟通摘要" value={lead.summary} multiline />
              <InfoRow label="关键信息" value={lead.keyInfo} multiline />
              <InfoRow label="核心问题" value={lead.coreProblem} multiline />
              <InfoRow label="当前需求" value={lead.currentNeed} multiline />
            </div>
          )}
        </Section>

        <Section title="销售判断">
          {editing && form ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <EditInput label="决策角色" value={form.decisionRole} onChange={(v) => patch({ decisionRole: v })} />
              <EditInput label="预算信号" value={form.budgetSignal} onChange={(v) => patch({ budgetSignal: v })} />
              <EditInput label="时间节点" value={form.timeline} onChange={(v) => patch({ timeline: v })} />
              <EditInput label="现有供应商" value={form.currentVendor} onChange={(v) => patch({ currentVendor: v })} />
              <div className="md:col-span-2">
                <FieldLabel>优先级</FieldLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {PRIORITIES.map((p) => {
                    const active = form.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => patch({ priority: p })}
                        className={cn(
                          "px-3 min-h-9 rounded-full border text-xs transition",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        {PRIORITY_LABEL[p]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <EditTextarea label="评分原因" value={form.priorityReason} onChange={(v) => patch({ priorityReason: v })} className="md:col-span-2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
              <InfoRow label="决策角色" value={lead.decisionRole} />
              <InfoRow label="预算信号" value={lead.budgetSignal} />
              <InfoRow label="时间节点" value={lead.timeline} />
              <InfoRow label="现有供应商" value={lead.currentVendor} />
              <InfoRow label="优先级" value={PRIORITY_LABEL[lead.priority]} />
              <InfoRow label="评分原因" value={lead.priorityReason} multiline />
            </div>
          )}
        </Section>

        <Section title="跟进">
          {editing && form ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <FieldLabel>当前状态</FieldLabel>
                <select
                  value={form.status}
                  onChange={(e) => patch({ status: e.target.value as ExpoStatus })}
                  className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <EditInput label="下一步动作" value={form.nextAction} onChange={(v) => patch({ nextAction: v })} />
              <EditInput
                label="下一步日期"
                type="date"
                value={form.nextActionDate}
                onChange={(v) => patch({ nextActionDate: v })}
              />
              <EditInput
                label="最近一次联系"
                type="date"
                value={form.lastContactedAt}
                onChange={(v) => patch({ lastContactedAt: v })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
              <InfoRow label="当前状态" value={STATUS_LABEL[lead.status]} />
              <InfoRow label="下一步动作" value={lead.nextAction} />
              <InfoRow label="下一步日期" value={lead.nextActionDate} />
              <InfoRow label="最近一次联系" value={lead.lastContactedAt ?? "尚未联系"} />
            </div>
          )}
        </Section>

        {!editing && (
          <Section title="附件" hint="下一阶段接入">
            <div className="grid grid-cols-2 gap-2">
              <AttachmentSlot icon={CreditCard} label="名片" />
              <AttachmentSlot icon={ImageIcon} label="现场照片" />
            </div>
          </Section>
        )}
      </div>

      {/* Sticky bottom action bar (edit mode) */}
      {editing && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur px-3 py-2.5 flex gap-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto w-full flex gap-2">
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="flex-1 h-11 rounded-lg border border-border text-sm bg-background disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              取消
            </button>
            <button
              onClick={() => void doSave()}
              disabled={saving || !dirty}
              className="flex-[1.4] inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "保存中…" : "保存修改"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5 mb-3">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground/90">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  multiline,
}: {
  label: string;
  value?: string | null;
  icon?: typeof Phone;
  multiline?: boolean;
}) {
  const empty = !value;
  return (
    <div className={cn("min-w-0", multiline ? "" : "flex items-baseline gap-3")}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0 w-20 md:w-24">
        {label}
      </div>
      <div
        className={cn(
          "text-sm min-w-0 break-words",
          empty ? "text-muted-foreground/60" : "text-foreground/90",
          multiline && "mt-0.5 whitespace-pre-wrap leading-relaxed",
        )}
      >
        {Icon && !empty && <Icon className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" />}
        {value || "—"}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
      />
    </div>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full min-h-[76px] px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 leading-relaxed"
      />
    </div>
  );
}

function AttachmentSlot({ icon: Icon, label }: { icon: typeof Paperclip; label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 grid place-items-center text-center text-xs text-muted-foreground bg-background/40">
      <Icon className="w-5 h-5 mb-1.5 opacity-60" />
      <div>{label}</div>
      <div className="text-[10px] mt-0.5 text-muted-foreground/70">下一阶段接入</div>
    </div>
  );
}
