import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  convertLeadToCustomer,
  LeadConversionFollowupError,
} from "@/lib/salesup/customerRepository";
import {
  STAGE_DEFAULT_WIN_RATE,
  type Customer,
  type DecisionRole,
} from "@/lib/salesup/customerTypes";
import type { Lead } from "@/lib/salesup/leadMock";

interface Props {
  lead: Omit<Lead, "status"> & { status: string };
  onClose: () => void;
  onConverted?: (customer: Customer) => void | Promise<void>;
}

const DECISION_ROLES: DecisionRole[] = [
  "decision_maker",
  "influencer",
  "user",
  "gatekeeper",
  "champion",
  "unknown",
];

function decisionRoleForLead(lead: Props["lead"]): DecisionRole {
  return DECISION_ROLES.includes(lead.decisionRole as DecisionRole)
    ? (lead.decisionRole as DecisionRole)
    : "unknown";
}

function previewValue(value: string | undefined | null): string {
  return value?.trim() || "—";
}

export function ConvertLeadDialog({ lead, onClose, onConverted }: Props) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState(lead.company);
  const [contactName, setContactName] = useState(lead.contactName);
  const [error, setError] = useState<string | null>(null);
  const [relatedCustomer, setRelatedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const previewRows = useMemo(
    () => [
      ["公司名", companyName],
      ["行业", lead.industry],
      ["公司背景", lead.companyBackground],
      ["联系人", contactName],
      ["联系人职位", lead.contactTitle],
      ["联系人部门", lead.contactDepartment],
      ["电话", lead.phone],
      ["微信", lead.wechat],
      ["邮箱", lead.email],
      ["当前供应商", lead.currentVendor],
      ["总部城市", lead.hqCity],
      ["公司规模", lead.companySize],
      ["官网", lead.website],
      ["痛点", lead.coreProblem],
      ["需求", lead.currentNeed],
      ["关键信息", lead.keyInfo],
      ["来源", lead.source],
      ["来源日期", lead.sourceDate],
      ["来源说明", lead.sourceDetail],
    ],
    [companyName, contactName, lead],
  );

  const handleConfirm = async () => {
    if (saving) return;
    if (!companyName.trim()) {
      setError("公司名不能为空。");
      return;
    }

    setSaving(true);
    setError(null);
    setRelatedCustomer(null);
    try {
      const result = await convertLeadToCustomer({
        leadId: lead.id,
        companyName,
        industry: lead.industry,
        companyBackground: lead.companyBackground,
        contactName,
        contactTitle: lead.contactTitle,
        contactDepartment: lead.contactDepartment,
        phone: lead.phone,
        wechat: lead.wechat,
        email: lead.email,
        currentVendor: lead.currentVendor,
        hqCity: lead.hqCity,
        companySize: lead.companySize,
        website: lead.website,
        painPoints: lead.coreProblem,
        needs: lead.currentNeed,
        keyInfo: lead.keyInfo,
        source: lead.source,
        sourceDate: lead.sourceDate,
        sourceDetail: lead.sourceDetail,
        decisionRole: decisionRoleForLead(lead),
        overseasMarkets: [],
        otherContacts: [],
        productLines: [],
        stage: "opportunity_confirmed",
        stageChangedAt: new Date().toISOString(),
        status: "active",
        winRate: null,
        winRateOverrideReason: "",
      });

      if (result.kind === "already_converted") {
        setRelatedCustomer(result.customer);
        setError("该线索已转为客户，可直接打开客户档案。");
        return;
      }

      toast.success(`已转为客户：${result.customer.companyName}`);
      await onConverted?.(result.customer);
      onClose();
    } catch (cause) {
      if (cause instanceof LeadConversionFollowupError) {
        setRelatedCustomer(cause.customer);
      }
      const message = cause instanceof Error ? cause.message : "转客户失败，请稍后重试。";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 md:items-center md:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--radius)] border border-border bg-card shadow-lg md:max-w-2xl md:rounded-[var(--radius)]">
        <header className="flex items-start gap-2 border-b border-border bg-secondary/50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              线索转为客户
            </div>
            <div className="mt-1 truncate text-sm font-medium">
              {lead.company || "（未命名线索）"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-[var(--radius)] p-1 text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            转换后将创建一条处于「机会确认」阶段的活跃客户。仅公司名和联系人可在此清洗，其余字段只读预览。
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              公司名
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="mt-1 h-9 w-full rounded-[var(--radius)] border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              联系人
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className="mt-1 h-9 w-full rounded-[var(--radius)] border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-[var(--radius)] border border-border">
            <div className="border-b border-border bg-secondary/50 px-3 py-2 text-xs font-medium">
              写入预览
            </div>
            <dl className="grid grid-cols-1 divide-y divide-border text-xs sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {previewRows.map(([label, value]) => (
                <div key={label} className="min-w-0 px-3 py-2 sm:odd:border-b sm:even:border-b">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 truncate text-foreground" title={previewValue(value)}>
                    {previewValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
              初始值：机会确认 · 活跃 · 当前有效胜率默认{" "}
              {STAGE_DEFAULT_WIN_RATE.opportunity_confirmed}%（未人工覆盖）
            </div>
          </div>

          {error && <div className="text-xs text-destructive">{error}</div>}
          {relatedCustomer && (
            <Link
              to="/customers/$id"
              params={{ id: relatedCustomer.id }}
              className="inline-flex h-8 items-center rounded-md border border-primary/40 px-3 text-xs font-medium text-primary hover:bg-primary/5"
            >
              打开客户：{relatedCustomer.companyName}
            </Link>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-[var(--radius)] border border-border bg-background px-3 text-sm hover:bg-secondary disabled:opacity-50"
          >
            取消
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            确认转为客户
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
