import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CornerUpLeft,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/salesup/AppShell";
import { StageChangeDialog } from "@/components/salesup/customer/StageChangeDialog";
import { useStageHistory } from "@/lib/salesup/useStageHistory";
import { todayKey } from "@/lib/salesup/date";
import { upsertReminder } from "@/lib/salesup/storage";

import { useCustomer } from "@/lib/salesup/useCustomer";
import {
  deleteCustomer,
  updateCustomer,
  type UpdateCustomerInput,
} from "@/lib/salesup/customerRepository";
import {
  ROLE_LABEL,
  SOURCE_LABEL,
  SOURCE_ORDER,
  STAGE_DEFAULT_WIN_RATE,
  STAGE_LABEL,
  STAGE_ORDER,
  STATUS_LABEL,
  staleDays,
  type Customer,
  type CustomerSource,
  type CustomerStage,
  type CustomerStatus,
  type DecisionRole,
  type OtherContact,
} from "@/lib/salesup/customerTypes";
import {
  Chip,
  Field,
  PRODUCT_LINE_OPTIONS,
  Section,
  SOURCE_DETAIL_PLACEHOLDER,
  TagInput,
  inputClass,
  sourceDetailLabel,
  textareaClass,
} from "@/components/salesup/CustomerFormFields";

export const Route = createFileRoute("/customers/$id")({
  head: () => ({
    meta: [
      { title: "客户详情 · Sales Up" },
      {
        name: "description",
        content: "查看并维护客户的来源、公司、联系人、商机与赢率信息。",
      },
      { property: "og:title", content: "客户详情 · Sales Up" },
      {
        property: "og:description",
        content: "查看并维护客户的来源、公司、联系人、商机与赢率信息。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetailPage,
});

interface FormState {
  source: CustomerSource;
  sourceDetail: string;
  sourceDate: string;
  claimExpiresAt: string;

  companyName: string;
  industry: string;
  companySize: string;
  overseasMarkets: string[];
  hqCity: string;
  website: string;
  currentVendor: string;
  companyBackground: string;

  contactName: string;
  contactTitle: string;
  contactDepartment: string;
  decisionRole: DecisionRole;
  phone: string;
  wechat: string;
  email: string;
  contactNote: string;
  otherContacts: OtherContact[];

  productLines: string[];
  stage: CustomerStage;
  status: CustomerStatus;
  overrideWinRate: boolean;
  winRate: string;
  winRateOverrideReason: string;
  amount: string;
  expectedCloseDate: string;
  nextAction: string;
  nextActionDate: string;
  lossReason: string;
  onHoldUntil: string;
  notes: string;
}

function toForm(c: Customer): FormState {
  return {
    source: c.source,
    sourceDetail: c.sourceDetail ?? "",
    sourceDate: c.sourceDate ?? "",
    claimExpiresAt: c.claimExpiresAt ?? "",
    companyName: c.companyName,
    industry: c.industry ?? "",
    companySize: c.companySize ?? "",
    overseasMarkets: c.overseasMarkets,
    hqCity: c.hqCity ?? "",
    website: c.website ?? "",
    currentVendor: c.currentVendor ?? "",
    companyBackground: c.companyBackground ?? "",
    contactName: c.contactName ?? "",
    contactTitle: c.contactTitle ?? "",
    contactDepartment: c.contactDepartment ?? "",
    decisionRole: c.decisionRole,
    phone: c.phone ?? "",
    wechat: c.wechat ?? "",
    email: c.email ?? "",
    contactNote: c.contactNote ?? "",
    otherContacts: c.otherContacts,
    productLines: c.productLines,
    stage: c.stage,
    status: c.status,
    overrideWinRate: c.winRate !== null,
    winRate: c.winRate !== null ? String(c.winRate) : "",
    winRateOverrideReason: c.winRateOverrideReason ?? "",
    amount: c.amount !== null ? String(c.amount) : "",
    expectedCloseDate: c.expectedCloseDate ?? "",
    nextAction: c.nextAction ?? "",
    nextActionDate: c.nextActionDate ?? "",
    lossReason: c.lossReason ?? "",
    onHoldUntil: c.onHoldUntil ?? "",
    notes: c.notes ?? "",
  };
}

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { customer, loading, error, userId, setCustomer, refresh } =
    useCustomer(id);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState<CustomerStage | null>(null);
  const [historyKey, setHistoryKey] = useState(0);


  useEffect(() => {
    setForm(customer ? toForm(customer) : null);
    setSaveError(null);
    setSavedAt(null);
  }, [customer]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const validate = (f: FormState): string | null => {
    if (!f.companyName.trim()) return "公司名不能为空。";
    if (f.overrideWinRate) {
      if (!f.winRateOverrideReason.trim()) return "覆盖赢率必须说明理由";
      const n = Number(f.winRate);
      if (!Number.isFinite(n) || n < 0 || n > 100)
        return "赢率需要是 0-100 之间的数字。";
    }
    if (f.status === "lost" && !f.lossReason.trim())
      return "切到「已丢」必须填写丢单原因。";
    if (f.status === "on_hold" && !f.onHoldUntil)
      return "切到「暂缓培育」必须填写唤醒日期。";
    return null;
  };

  const handleSave = async () => {
    if (!form || !customer) return;
    const msg = validate(form);
    if (msg) {
      setSaveError(msg);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const amountNum =
        form.amount.trim() === "" ? null : Number(form.amount.trim());
      const patch: UpdateCustomerInput = {
        companyName: form.companyName,
        source: form.source,
        sourceDetail: form.sourceDetail,
        sourceDate: form.sourceDate,
        claimExpiresAt:
          form.source === "list_claimed" ? form.claimExpiresAt : "",
        industry: form.industry,
        companySize: form.companySize,
        overseasMarkets: form.overseasMarkets,
        hqCity: form.hqCity,
        website: form.website,
        currentVendor: form.currentVendor,
        companyBackground: form.companyBackground,
        contactName: form.contactName,
        contactTitle: form.contactTitle,
        contactDepartment: form.contactDepartment,
        decisionRole: form.decisionRole,
        phone: form.phone,
        wechat: form.wechat,
        email: form.email,
        contactNote: form.contactNote,
        otherContacts: form.otherContacts.filter(
          (o) => (o.name ?? "").trim() || (o.contact ?? "").trim(),
        ),
        productLines: form.productLines,
        status: form.status,
        winRate: form.overrideWinRate ? Number(form.winRate) : null,
        winRateOverrideReason: form.overrideWinRate
          ? form.winRateOverrideReason
          : "",
        amount:
          amountNum !== null && Number.isFinite(amountNum) ? amountNum : null,
        expectedCloseDate: form.expectedCloseDate,
        nextAction: form.nextAction,
        nextActionDate: form.nextActionDate,
        lossReason: form.status === "lost" ? form.lossReason : "",
        onHoldUntil: form.status === "on_hold" ? form.onHoldUntil : "",
        notes: form.notes,
      };
      const updated = await updateCustomer(customer.id, patch);
      setCustomer(updated);
      setSavedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await deleteCustomer(customer.id);
      await navigate({ to: "/customers" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "删除失败，请重试。");
      setSaving(false);
    }
  };

  const handleGenerateReminder = () => {
    if (!form || !form.nextAction.trim()) return;
    upsertReminder({
      title: form.nextAction.trim(),
      type: "todo",
      frequency: "once",
      related_date: form.nextActionDate || todayKey(),
      customer: form.companyName,
      related_block_id: null,
      priority: "medium",
      status: "pending",
      note: form.notes,
    });
    setReminderMsg("已生成提醒，可在提醒中心查看。");
    if (typeof window !== "undefined") {
      window.setTimeout(() => setReminderMsg(null), 3000);
    }
  };

  const stageRate = form ? STAGE_DEFAULT_WIN_RATE[form.stage] : 0;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24">
        <div className="mb-4 flex items-center gap-2">
          <Link
            to="/customers"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回看板
          </Link>
        </div>

        {!userId && !loading && (
          <div className="rounded-[var(--radius)] border border-dashed border-border py-12 text-center">
            <div className="text-sm font-medium">请先登录</div>
            <Link
              to="/auth"
              className="mt-3 inline-flex h-8 px-3 items-center rounded-md bg-primary text-primary-foreground text-xs"
            >
              去登录
            </Link>
          </div>
        )}

        {userId && loading && (
          <div className="rounded-[var(--radius)] border border-dashed border-border py-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在加载…
          </div>
        )}

        {userId && !loading && error && (
          <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-medium">加载失败</div>
            <div className="text-xs mt-1 break-words">{error}</div>
            <button
              onClick={() => void refresh()}
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-destructive text-destructive-foreground text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试
            </button>
          </div>
        )}

        {userId && !loading && !error && !customer && (
          <div className="rounded-[var(--radius)] border border-dashed border-border py-12 text-center text-sm">
            没有找到这个客户，可能已被删除。
          </div>
        )}

        {customer && form && (
          <>
            {/* 顶部信息 */}
            <header className="rounded-[var(--radius)] border border-border bg-card p-3 md:p-4">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight break-words">
                {customer.companyName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setStagePickerOpen((v) => !v)}
                  title="点击推进或回退阶段"
                  className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground inline-flex items-center gap-1 hover:bg-secondary/80 transition"
                >
                  {STAGE_LABEL[customer.stage]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {STATUS_LABEL[customer.status]}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground tabular-nums">
                  停滞 {staleDays(customer)} 天
                </span>
              </div>

              {stagePickerOpen && (
                <div className="mt-2 rounded-[var(--radius)] border border-border bg-background p-2">
                  <div className="text-[11px] text-muted-foreground mb-1.5">
                    选择目标阶段
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGE_ORDER.map((s, i) => {
                      const cur = s === customer.stage;
                      const backward = i < STAGE_ORDER.indexOf(customer.stage);
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={cur}
                          onClick={() => {
                            setStagePickerOpen(false);
                            setStageTarget(s);
                          }}
                          className={cn(
                            "px-2.5 h-7 rounded-full text-xs border transition",
                            cur
                              ? "bg-secondary text-secondary-foreground border-border cursor-default"
                              : backward
                                ? "bg-background text-muted-foreground border-dashed border-border hover:text-foreground"
                                : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary/40",
                          )}
                        >
                          {STAGE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </header>

            {/* 阶段历史 */}
            <StageHistorySection customerId={customer.id} refreshKey={historyKey} />

            {stageTarget && (
              <StageChangeDialog
                customer={customer}
                targetStage={stageTarget}
                onClose={() => setStageTarget(null)}
                onChanged={(updated) => {
                  setCustomer(updated);
                  setHistoryKey((k) => k + 1);
                }}
              />
            )}


            <div className="mt-3 space-y-3">
              <Section title="来源" defaultOpen>
                <Field label="来源" full>
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCE_ORDER.map((s) => (
                      <Chip
                        key={s}
                        active={form.source === s}
                        onClick={() => set("source", s)}
                      >
                        {SOURCE_LABEL[s]}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label={sourceDetailLabel(form.source)} full>
                  <input
                    value={form.sourceDetail}
                    onChange={(e) => set("sourceDetail", e.target.value)}
                    placeholder={SOURCE_DETAIL_PLACEHOLDER[form.source]}
                    className={inputClass}
                  />
                </Field>
                <Field label="拿到日期">
                  <input
                    type="date"
                    value={form.sourceDate}
                    onChange={(e) => set("sourceDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {form.source === "list_claimed" && (
                  <Field label="认领有效期">
                    <input
                      type="date"
                      value={form.claimExpiresAt}
                      onChange={(e) => set("claimExpiresAt", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                )}
              </Section>

              <Section title="公司" defaultOpen>
                <Field label="公司名（必填）" full>
                  <input
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="行业">
                  <input
                    value={form.industry}
                    onChange={(e) => set("industry", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="公司规模">
                  <input
                    value={form.companySize}
                    onChange={(e) => set("companySize", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="出海目标市场" full>
                  <TagInput
                    value={form.overseasMarkets}
                    onChange={(v) => set("overseasMarkets", v)}
                  />
                </Field>
                <Field label="总部城市">
                  <input
                    value={form.hqCity}
                    onChange={(e) => set("hqCity", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="官网">
                  <input
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="现有供应商" full>
                  <input
                    value={form.currentVendor}
                    onChange={(e) => set("currentVendor", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="公司背景" full>
                  <textarea
                    rows={3}
                    value={form.companyBackground}
                    onChange={(e) => set("companyBackground", e.target.value)}
                    className={textareaClass}
                  />
                </Field>
              </Section>

              <Section title="主联系人">
                <Field label="姓名">
                  <input
                    value={form.contactName}
                    onChange={(e) => set("contactName", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="职位">
                  <input
                    value={form.contactTitle}
                    onChange={(e) => set("contactTitle", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="部门">
                  <input
                    value={form.contactDepartment}
                    onChange={(e) => set("contactDepartment", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="决策角色">
                  <select
                    value={form.decisionRole}
                    onChange={(e) =>
                      set("decisionRole", e.target.value as DecisionRole)
                    }
                    className={inputClass}
                  >
                    {(Object.keys(ROLE_LABEL) as DecisionRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="电话">
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="微信">
                  <input
                    value={form.wechat}
                    onChange={(e) => set("wechat", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="邮箱" full>
                  <input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="沟通偏好备注" full>
                  <textarea
                    rows={3}
                    value={form.contactNote}
                    onChange={(e) => set("contactNote", e.target.value)}
                    className={textareaClass}
                  />
                </Field>
              </Section>

              <Section title="其他关键人" hint={`${form.otherContacts.length} 人`}>
                <div className="sm:col-span-2 space-y-2">
                  {form.otherContacts.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      还没有登记其他关键人。
                    </div>
                  )}
                  {form.otherContacts.map((oc, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--radius)] border border-border p-2.5 space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          value={oc.name ?? ""}
                          placeholder="姓名"
                          onChange={(e) =>
                            set(
                              "otherContacts",
                              form.otherContacts.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                        <input
                          value={oc.title ?? ""}
                          placeholder="职位"
                          onChange={(e) =>
                            set(
                              "otherContacts",
                              form.otherContacts.map((x, j) =>
                                j === i ? { ...x, title: e.target.value } : x,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                        <select
                          value={oc.decisionRole ?? "unknown"}
                          onChange={(e) =>
                            set(
                              "otherContacts",
                              form.otherContacts.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      decisionRole: e.target
                                        .value as DecisionRole,
                                    }
                                  : x,
                              ),
                            )
                          }
                          className={inputClass}
                        >
                          {(Object.keys(ROLE_LABEL) as DecisionRole[]).map(
                            (r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ),
                          )}
                        </select>
                        <input
                          value={oc.contact ?? ""}
                          placeholder="联系方式"
                          onChange={(e) =>
                            set(
                              "otherContacts",
                              form.otherContacts.map((x, j) =>
                                j === i ? { ...x, contact: e.target.value } : x,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={oc.note ?? ""}
                        placeholder="备注"
                        onChange={(e) =>
                          set(
                            "otherContacts",
                            form.otherContacts.map((x, j) =>
                              j === i ? { ...x, note: e.target.value } : x,
                            ),
                          )
                        }
                        className={textareaClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "otherContacts",
                            form.otherContacts.filter((_, j) => j !== i),
                          )
                        }
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        移除
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      set("otherContacts", [
                        ...form.otherContacts,
                        { decisionRole: "unknown" },
                      ])
                    }
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius)] border border-border text-xs hover:bg-muted"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加关键人
                  </button>
                </div>
              </Section>

              <Section title="商机" defaultOpen>
                <Field label="产品线" full>
                  <TagInput
                    value={form.productLines}
                    onChange={(v) => set("productLines", v)}
                    options={PRODUCT_LINE_OPTIONS}
                  />
                </Field>
                <Field label="当前阶段" full>
                  <div className="text-xs text-muted-foreground">
                    {STAGE_LABEL[form.stage]}
                    <span className="ml-2">（阶段推进在后续版本提供）</span>
                  </div>
                </Field>
                <Field label="预估金额（元）">
                  <input
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="预计成交时间">
                  <input
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) => set("expectedCloseDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="下一步动作" full>
                  <div className="flex gap-2">
                    <input
                      value={form.nextAction}
                      onChange={(e) => set("nextAction", e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateReminder}
                      disabled={!form.nextAction.trim()}
                      className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-[var(--radius)] border border-border text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      生成提醒
                    </button>
                  </div>
                </Field>
                <Field label="下一步日期">
                  <input
                    type="date"
                    value={form.nextActionDate}
                    onChange={(e) => set("nextActionDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="备注" full>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    className={textareaClass}
                  />
                </Field>
                {reminderMsg && (
                  <div className="sm:col-span-2 text-xs text-muted-foreground">
                    {reminderMsg}
                  </div>
                )}
              </Section>

              {/* 赢率 */}
              <Section title="赢率" defaultOpen>
                <div className="sm:col-span-2 space-y-2">
                  {!form.overrideWinRate && (
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {stageRate}%
                      <span className="ml-2 text-xs">（按阶段）</span>
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.overrideWinRate}
                      onChange={(e) => set("overrideWinRate", e.target.checked)}
                    />
                    手动覆盖
                  </label>
                  {form.overrideWinRate && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="赢率（0-100）">
                        <input
                          inputMode="numeric"
                          value={form.winRate}
                          onChange={(e) => set("winRate", e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="覆盖理由（必填）" full>
                        <textarea
                          rows={2}
                          value={form.winRateOverrideReason}
                          onChange={(e) =>
                            set("winRateOverrideReason", e.target.value)
                          }
                          className={textareaClass}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </Section>

              {/* 状态 */}
              <Section title="状态" defaultOpen>
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      Object.keys(STATUS_LABEL) as CustomerStatus[]
                    ).map((s) => (
                      <Chip
                        key={s}
                        active={form.status === s}
                        onClick={() => set("status", s)}
                      >
                        {STATUS_LABEL[s]}
                      </Chip>
                    ))}
                  </div>
                  {(form.status === "lost" || form.status === "on_hold") && (
                    <div className="text-xs text-muted-foreground">
                      切换到「{STATUS_LABEL[form.status]}」后，该客户会从主看板消失。
                    </div>
                  )}
                  {form.status === "lost" && (
                    <Field label="丢单原因（必填）" full>
                      <textarea
                        rows={2}
                        value={form.lossReason}
                        onChange={(e) => set("lossReason", e.target.value)}
                        className={textareaClass}
                      />
                    </Field>
                  )}
                  {form.status === "on_hold" && (
                    <Field label="唤醒日期（必填）">
                      <input
                        type="date"
                        value={form.onHoldUntil}
                        onChange={(e) => set("onHoldUntil", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              </Section>

              {/* 删除 */}
              <section className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 p-3">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius)] border border-destructive/40 text-xs text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除客户
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-destructive">
                      确认删除「{customer.companyName}」？该操作不可撤销。
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDelete()}
                      className="h-8 px-3 rounded-[var(--radius)] bg-destructive text-destructive-foreground text-xs disabled:opacity-60"
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 px-3 rounded-[var(--radius)] border border-border text-xs"
                    >
                      取消
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* 保存条 */}
            <div className="fixed bottom-0 left-0 right-0 md:sticky md:bottom-0 z-10 bg-background/95 backdrop-blur border-t border-border px-4 py-3 md:px-0">
              <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  保存修改
                </button>
                {savedAt && !saveError && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs text-muted-foreground",
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    已保存 {savedAt}
                  </span>
                )}
                {saveError && (
                  <span className="text-xs text-destructive break-words">
                    {saveError}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
