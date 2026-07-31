import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { todayKey } from "@/lib/salesup/date";
import { createCustomer, insertStageHistory } from "@/lib/salesup/customerRepository";
import {
  ROLE_LABEL,
  SOURCE_LABEL,
  SOURCE_ORDER,
  type CustomerSource,
  type DecisionRole,
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

export const Route = createFileRoute("/customers/new")({
  head: () => ({
    meta: [
      { title: "新建客户 · Sales Up" },
      {
        name: "description",
        content: "登记新的客户与商机：来源、公司、主联系人与商机信息。",
      },
      { property: "og:title", content: "新建客户 · Sales Up" },
      {
        property: "og:description",
        content: "登记新的客户与商机：来源、公司、主联系人与商机信息。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCustomerPage,
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

  productLines: string[];
  amount: string;
  expectedCloseDate: string;
  nextAction: string;
  nextActionDate: string;
}

const EMPTY: FormState = {
  source: "list_claimed",
  sourceDetail: "",
  sourceDate: todayKey(),
  claimExpiresAt: "",
  companyName: "",
  industry: "",
  companySize: "",
  overseasMarkets: [],
  hqCity: "",
  website: "",
  currentVendor: "",
  companyBackground: "",
  contactName: "",
  contactTitle: "",
  contactDepartment: "",
  decisionRole: "unknown",
  phone: "",
  wechat: "",
  email: "",
  contactNote: "",
  productLines: [],
  amount: "",
  expectedCloseDate: "",
  nextAction: "",
  nextActionDate: "",
};

function NewCustomerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isExpoSource = form.source === "expo";

  const handleSave = async () => {
    if (isExpoSource) {
      setError("展会线索请从展会线索页录入后转化为客户。");
      return;
    }
    const name = form.companyName.trim();
    if (!name) {
      setError("请填写公司名。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amount = form.amount.trim() === "" ? null : Number(form.amount.trim());
      const created = await createCustomer({
        companyName: name,
        source: form.source,
        sourceDetail: form.sourceDetail,
        sourceDate: form.sourceDate,
        claimExpiresAt: form.source === "list_claimed" ? form.claimExpiresAt : "",
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
        productLines: form.productLines,
        stage: "opportunity_confirmed",
        amount: amount !== null && Number.isFinite(amount) ? amount : null,
        expectedCloseDate: form.expectedCloseDate,
        nextAction: form.nextAction,
        nextActionDate: form.nextActionDate,
      });

      try {
        await insertStageHistory({
          customerId: created.id,
          fromStage: null,
          toStage: created.stage,
          reason: "建档",
        });
      } catch {
        // 阶段留痕失败不阻断建档
      }

      await navigate({ to: "/customers/$id", params: { id: created.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center gap-2">
          <Link
            to="/customers"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回看板
          </Link>
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">新建客户</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          除公司名外全部选填，可以先建档再补充。
        </p>

        {error && (
          <div className="mb-3 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive break-words">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Section title="来源" defaultOpen>
            <Field label="来源（必选）" full>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_ORDER.map((s) => (
                  <Chip key={s} active={form.source === s} onClick={() => set("source", s)}>
                    {SOURCE_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </Field>
            {isExpoSource && (
              <div className="sm:col-span-2 rounded-[var(--radius)] border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                展会线索不能在这里直接新建。请先到
                <Link to="/expo" className="mx-1 text-primary hover:underline">
                  展会线索
                </Link>
                录入，再从线索详情转化为客户。
              </div>
            )}
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

          <Section title="公司" hint="公司名必填" defaultOpen>
            <Field label="公司名（必填）" full>
              <input
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="例如：某某科技有限公司"
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
                placeholder="如 500-1000 人"
                className={inputClass}
              />
            </Field>
            <Field label="出海目标市场" full>
              <TagInput
                value={form.overseasMarkets}
                onChange={(v) => set("overseasMarkets", v)}
                placeholder="如 东南亚，回车追加"
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
                onChange={(e) => set("decisionRole", e.target.value as DecisionRole)}
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

          <Section title="商机">
            <Field label="产品线" full>
              <TagInput
                value={form.productLines}
                onChange={(v) => set("productLines", v)}
                options={PRODUCT_LINE_OPTIONS}
                placeholder="自定义产品线，回车追加"
              />
            </Field>
            <Field label="阶段" full>
              <div className="text-xs text-muted-foreground">
                机会确认（直接新建的客户固定从此阶段开始）
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
              <input
                value={form.nextAction}
                onChange={(e) => set("nextAction", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="下一步日期">
              <input
                type="date"
                value={form.nextActionDate}
                onChange={(e) => set("nextActionDate", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Section>
        </div>

        <div className="sticky bottom-0 mt-4 py-3 bg-background/95 backdrop-blur border-t border-border flex gap-2">
          <button
            type="button"
            disabled={saving || isExpoSource}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            保存客户
          </button>
          <Link
            to="/customers"
            className="inline-flex items-center h-9 px-4 rounded-[var(--radius)] border border-border text-sm"
          >
            取消
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
