// 线索 → 客户 的确认弹窗。
// 数据层调用全部走 customerRepository，组件内不直接调 supabase。
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { convertLeadToCustomer } from "@/lib/salesup/customerRepository";
import {
  ROLE_LABEL,
  SOURCE_LABEL,
  type Customer,
  type DecisionRole,
} from "@/lib/salesup/customerTypes";
import type { Lead } from "@/lib/salesup/expoMock";

interface Props {
  lead: Lead;
  onClose: () => void;
  onConverted?: (customer: Customer) => void;
}

const ROLE_KEYS = Object.keys(ROLE_LABEL) as DecisionRole[];

const ADMISSION_ITEMS = [
  {
    key: "contactChannel",
    label: "已建立可持续联系渠道",
    hint: "已加微信或有对方直线电话",
    summaryLabel: "联系渠道",
  },
  {
    key: "needDiscovered",
    label: "已挖掘出明确的需求或痛点",
    hint: "确认了可推进的问题或机会",
    summaryLabel: "需求挖掘",
  },
  {
    key: "willingToProceed",
    label: "对方有推进意愿",
    hint: "愿意继续沟通下一步",
    summaryLabel: "推进意愿",
  },
] as const;

type AdmissionKey = (typeof ADMISSION_ITEMS)[number]["key"];
type AdmissionChecks = Record<AdmissionKey, boolean>;

/** 线索里的自由文本决策角色映射到枚举，识别不了就 unknown。 */
function guessDecisionRole(raw?: string): DecisionRole {
  const v = (raw ?? "").trim();
  if (!v) return "unknown";
  if ((ROLE_KEYS as string[]).includes(v)) return v as DecisionRole;
  for (const k of ROLE_KEYS) {
    if (ROLE_LABEL[k] === v) return k;
  }
  return "unknown";
}

interface FormState {
  companyName: string;
  industry: string;
  companyBackground: string;
  painPoints: string;
  needs: string;
  keyInfo: string;
  contactName: string;
  contactTitle: string;
  phone: string;
  wechat: string;
  email: string;
  decisionRole: DecisionRole;
  currentVendor: string;
  nextAction: string;
  nextActionDate: string;
  sourceDetail: string;
  sourceDate: string;
}

export function ConvertLeadDialog({ lead, onClose, onConverted }: Props) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admission, setAdmission] = useState<AdmissionChecks>({
    contactChannel: false,
    needDiscovered: false,
    willingToProceed: false,
  });
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [form, setForm] = useState<FormState>({
    companyName: lead.company ?? "",
    industry: lead.industry ?? "",
    companyBackground: lead.companyBackground ?? "",
    painPoints: lead.coreProblem ?? "",
    needs: lead.currentNeed ?? "",
    keyInfo: lead.keyInfo ?? "",
    contactName: lead.contactName ?? "",
    contactTitle: lead.contactTitle ?? "",
    phone: lead.phone ?? "",
    wechat: lead.wechat ?? "",
    email: lead.email ?? "",
    decisionRole: guessDecisionRole(lead.decisionRole),
    currentVendor: lead.currentVendor ?? "",
    nextAction: lead.nextAction ?? "",
    nextActionDate: lead.nextActionDate ?? "",
    sourceDetail: lead.sourceDetail ?? lead.eventName ?? "",
    sourceDate: lead.sourceDate ?? lead.eventDate ?? "",
  });

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const allAdmissionConfirmed = ADMISSION_ITEMS.every((item) => admission[item.key]);
  const exceptionReasonTrimmed = exceptionReason.trim();
  const canConvert = allAdmissionConfirmed || (exceptionOpen && exceptionReasonTrimmed.length > 0);

  const toggleAdmission = (key: AdmissionKey) => {
    setAdmission((current) => ({ ...current, [key]: !current[key] }));
  };

  const conversionReason = () => {
    const result = ADMISSION_ITEMS.map(
      (item) => `${item.summaryLabel}${admission[item.key] ? "✓" : "✗"}`,
    ).join(" ");
    if (allAdmissionConfirmed) return `准入确认:${result}`;
    const unmet = ADMISSION_ITEMS.filter((item) => !admission[item.key])
      .map((item) => item.summaryLabel)
      .join("、");
    return `准入例外:${result}；未满足:${unmet}；理由:${exceptionReasonTrimmed}`;
  };

  const handleConfirm = async () => {
    if (saving) return;
    if (!form.companyName.trim()) {
      setError("公司名不能为空。");
      return;
    }
    if (!canConvert) {
      setError("请完成三项准入确认，或填写例外转化理由。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const customer = await convertLeadToCustomer({
        leadId: lead.id,
        conversionReason: conversionReason(),
        source: lead.source,
        companyName: form.companyName,
        industry: form.industry,
        companySize: lead.companySize,
        hqCity: lead.hqCity,
        website: lead.website,
        companyBackground: form.companyBackground,
        painPoints: form.painPoints,
        needs: form.needs,
        keyInfo: form.keyInfo,
        contactName: form.contactName,
        contactTitle: form.contactTitle,
        contactDepartment: lead.contactDepartment,
        phone: form.phone,
        wechat: form.wechat,
        email: form.email,
        decisionRole: form.decisionRole,
        currentVendor: form.currentVendor,
        nextAction: form.nextAction,
        nextActionDate: form.nextActionDate,
        sourceDetail: form.sourceDetail,
        sourceDate: form.sourceDate,
        stage: "opportunity_confirmed",
        status: "active",
      });
      toast.success(`已转为客户「${customer.companyName}」`);
      onConverted?.(customer);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "转化失败，请重试。";
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/30 p-0 md:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full md:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[var(--radius)] md:rounded-[var(--radius)] border border-border bg-card shadow-lg">
        <header className="flex items-start gap-2 px-4 py-3 border-b border-border bg-secondary/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowRight className="w-3.5 h-3.5" />
              线索 转为 客户
            </div>
            <div className="mt-1 text-sm font-medium truncate">
              {lead.company || "(未命名线索)"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[var(--radius)] text-muted-foreground hover:bg-secondary"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            以下字段已从线索预填，可在此调整；来源固定为「{SOURCE_LABEL[lead.source]}」。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <TextField
              label="公司名"
              value={form.companyName}
              onChange={(v) => patch({ companyName: v })}
              className="md:col-span-2"
            />
            <TextField
              label="行业"
              value={form.industry}
              onChange={(v) => patch({ industry: v })}
            />
            <TextField
              label="现有供应商"
              value={form.currentVendor}
              onChange={(v) => patch({ currentVendor: v })}
            />
            <div className="md:col-span-2">
              <FieldLabel>公司背景</FieldLabel>
              <textarea
                value={form.companyBackground}
                onChange={(e) => patch({ companyBackground: e.target.value })}
                rows={2}
                className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>痛点</FieldLabel>
              <textarea
                value={form.painPoints}
                onChange={(e) => patch({ painPoints: e.target.value })}
                rows={2}
                className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>当前需求</FieldLabel>
              <textarea
                value={form.needs}
                onChange={(e) => patch({ needs: e.target.value })}
                rows={2}
                className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>关键信息</FieldLabel>
              <textarea
                value={form.keyInfo}
                onChange={(e) => patch({ keyInfo: e.target.value })}
                rows={2}
                className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <TextField
              label="联系人"
              value={form.contactName}
              onChange={(v) => patch({ contactName: v })}
            />
            <TextField
              label="职位"
              value={form.contactTitle}
              onChange={(v) => patch({ contactTitle: v })}
            />
            <TextField label="电话" value={form.phone} onChange={(v) => patch({ phone: v })} />
            <TextField label="微信" value={form.wechat} onChange={(v) => patch({ wechat: v })} />
            <TextField label="邮箱" value={form.email} onChange={(v) => patch({ email: v })} />
            <div>
              <FieldLabel>决策角色</FieldLabel>
              <select
                value={form.decisionRole}
                onChange={(e) => patch({ decisionRole: e.target.value as DecisionRole })}
                className="w-full h-8 px-2 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
              >
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              label="来源说明"
              value={form.sourceDetail}
              onChange={(v) => patch({ sourceDetail: v })}
            />
            <TextField
              label="拿到日期"
              type="date"
              value={form.sourceDate}
              onChange={(v) => patch({ sourceDate: v })}
            />
            <TextField
              label="下一步动作"
              value={form.nextAction}
              onChange={(v) => patch({ nextAction: v })}
            />
            <TextField
              label="下一步日期"
              type="date"
              value={form.nextActionDate}
              onChange={(v) => patch({ nextActionDate: v })}
            />
          </div>

          <div className="rounded-[var(--radius)] border border-border bg-secondary/40 px-3 py-2.5">
            <div className="text-xs font-medium text-foreground/90">准入确认</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              三项全部确认后，线索才会进入客户看板的机会确认阶段。
            </p>
            <div className="mt-2.5 space-y-2">
              {ADMISSION_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-2 rounded-[var(--radius)] border border-border bg-background px-2.5 py-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={admission[item.key]}
                    onChange={() => toggleAdmission(item.key)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>
                    <span className="text-foreground/90">{item.label}</span>
                    <span className="ml-1 text-muted-foreground">（{item.hint}）</span>
                  </span>
                </label>
              ))}
            </div>

            {!allAdmissionConfirmed && (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setExceptionOpen((open) => !open)}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {exceptionOpen ? "收起例外转化" : "仍要转为客户"}
                </button>
                {exceptionOpen && (
                  <div className="mt-2">
                    <FieldLabel>例外转化理由（必填）</FieldLabel>
                    <textarea
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      rows={3}
                      placeholder="说明为何在准入条件未完全满足时仍需建立客户档案"
                      className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="text-xs text-destructive break-words">{error}</div>}
        </div>

        <footer className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-[var(--radius)] border border-border bg-background text-sm hover:bg-secondary"
          >
            取消
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || !canConvert}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-sm disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            确认转化
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-muted-foreground mb-1">{children}</div>;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}
