import { useMemo } from "react";
import { TableFieldControls } from "@/components/salesup/table/TableFieldControls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/salesup/csv";
import {
  getEffectiveWinRate,
  ROLE_LABEL,
  SOURCE_LABEL,
  STAGE_COLOR_TOKEN,
  STAGE_LABEL,
  STATUS_LABEL,
  type CustomerStage,
} from "@/lib/salesup/customerTypes";
import { useTableFieldPreferences } from "@/lib/salesup/tableFields";
import { cn } from "@/lib/utils";
import type { Contact, OpportunityWithDetails } from "@/lib/salesup/opportunityTypes";

type ColumnKey =
  | "customerName"
  | "opportunityName"
  | "productLines"
  | "amount"
  | "stage"
  | "status"
  | "winRate"
  | "expectedCloseDate"
  | "nextAction"
  | "nextActionDate"
  | "lastContactAt"
  | "painPoints"
  | "needs"
  | "keyInfo"
  | "lossReason"
  | "onHoldUntil"
  | "industry"
  | "companySize"
  | "hqCity"
  | "website"
  | "currentVendor"
  | "source"
  | "sourceDate"
  | "primaryContact"
  | "contactTitle"
  | "contactDepartment"
  | "phone"
  | "wechat"
  | "email";
type PresetKey = "default" | "all" | "custom";
type CustomColumnKey = Exclude<ColumnKey, "customerName">;

const COLUMN_LABEL: Record<ColumnKey, string> = {
  customerName: "所属客户",
  opportunityName: "商机名",
  productLines: "产品线",
  amount: "金额",
  stage: "阶段",
  status: "状态",
  winRate: "赢率",
  expectedCloseDate: "预计成交日",
  nextAction: "下一步动作",
  nextActionDate: "下一步日期",
  lastContactAt: "最近联系",
  painPoints: "痛点",
  needs: "需求",
  keyInfo: "关键信息",
  lossReason: "丢单原因",
  onHoldUntil: "暂缓至",
  industry: "行业",
  companySize: "公司规模",
  hqCity: "总部城市",
  website: "网站",
  currentVendor: "当前供应商",
  source: "来源",
  sourceDate: "来源日期",
  primaryContact: "主联系人",
  contactTitle: "职位",
  contactDepartment: "部门",
  phone: "电话",
  wechat: "微信",
  email: "邮箱",
};
const PRESETS: Record<Exclude<PresetKey, "custom">, ColumnKey[]> = {
  default: [
    "customerName",
    "opportunityName",
    "stage",
    "amount",
    "winRate",
    "primaryContact",
    "nextActionDate",
  ],
  all: Object.keys(COLUMN_LABEL) as ColumnKey[],
};
const PRESET_VALUES: PresetKey[] = ["default", "all", "custom"];
const CUSTOM_FIELDS = (Object.keys(COLUMN_LABEL) as ColumnKey[]).filter(
  (field): field is CustomColumnKey => field !== "customerName",
);
const PRESET_OPTIONS = [
  { value: "default", label: "默认字段" },
  { value: "all", label: "全部字段" },
  { value: "custom", label: "自定义" },
];

function display(value: string | null | undefined): string {
  return value?.trim() || "—";
}
function dateValue(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}
function formatAmount(amount: number, currency: string): string {
  return `${currency === "CNY" ? "¥" : `${currency} `}${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
function primaryContact(opportunity: OpportunityWithDetails): Contact | undefined {
  return opportunity.contacts.find((contact) => contact.isPrimary);
}

function Cell({
  field,
  opportunity,
  today,
}: {
  field: ColumnKey;
  opportunity: OpportunityWithDetails;
  today: string;
}) {
  const contact = primaryContact(opportunity);
  const overdue =
    !!opportunity.nextAction && !!opportunity.nextActionDate && opportunity.nextActionDate < today;
  switch (field) {
    case "customerName":
      return (
        <span className="block min-w-40">
          <span className="block truncate text-[13.5px] font-semibold leading-5">
            {opportunity.customer.companyName}
          </span>
          <span className="block truncate text-[11.5px] leading-4 text-muted-foreground">
            {display(opportunity.customer.industry)}
          </span>
        </span>
      );
    case "opportunityName":
      return <span className="font-medium text-primary">{opportunity.name}</span>;
    case "productLines":
      return opportunity.productLines.length ? (
        <span className="flex flex-wrap gap-1">
          {opportunity.productLines.map((line) => (
            <span
              key={line}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {line}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "amount":
      return opportunity.amount === null ? (
        <span className="text-xs text-muted-foreground">金额待定</span>
      ) : (
        <span className="font-semibold tabular-nums text-primary">
          {formatAmount(opportunity.amount, opportunity.currency)}
        </span>
      );
    case "stage": {
      const token = STAGE_COLOR_TOKEN[opportunity.stage];
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `var(${token})` }} />
          {STAGE_LABEL[opportunity.stage]}
        </span>
      );
    }
    case "status":
      return <span>{STATUS_LABEL[opportunity.status]}</span>;
    case "winRate": {
      const rate = getEffectiveWinRate(opportunity);
      return (
        <span className="flex min-w-24 items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-border/70">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </span>
          <span
            className={cn("text-xs tabular-nums", opportunity.winRate !== null && "font-semibold")}
          >
            {rate}%
            {opportunity.winRate !== null && (
              <span className="ml-1 rounded border border-primary/30 bg-primary/5 px-1 py-px text-[9px] font-medium text-primary">
                手动
              </span>
            )}
          </span>
        </span>
      );
    }
    case "expectedCloseDate":
      return dateValue(opportunity.expectedCloseDate);
    case "nextAction":
      return display(opportunity.nextAction);
    case "nextActionDate":
      return (
        <span
          className={cn(
            "tabular-nums",
            overdue ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {dateValue(opportunity.nextActionDate)}
          {overdue ? "（逾期）" : ""}
        </span>
      );
    case "lastContactAt":
      return dateValue(opportunity.lastContactAt);
    case "painPoints":
      return display(opportunity.painPoints);
    case "needs":
      return display(opportunity.needs);
    case "keyInfo":
      return display(opportunity.keyInfo);
    case "lossReason":
      return display(opportunity.lossReason);
    case "onHoldUntil":
      return dateValue(opportunity.onHoldUntil);
    case "industry":
      return display(opportunity.customer.industry);
    case "companySize":
      return display(opportunity.customer.companySize);
    case "hqCity":
      return display(opportunity.customer.hqCity);
    case "website":
      return display(opportunity.customer.website);
    case "currentVendor":
      return display(opportunity.customer.currentVendor);
    case "source":
      return (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {SOURCE_LABEL[opportunity.customer.source]}
        </span>
      );
    case "sourceDate":
      return dateValue(opportunity.customer.sourceDate);
    case "primaryContact":
      return display(contact?.name);
    case "contactTitle":
      return display(contact?.title);
    case "contactDepartment":
      return display(contact?.department);
    case "phone":
      return display(contact?.phone);
    case "wechat":
      return display(contact?.wechat);
    case "email":
      return display(contact?.email);
  }
}

function csvValue(field: ColumnKey, opportunity: OpportunityWithDetails): string {
  const contact = primaryContact(opportunity);
  switch (field) {
    case "customerName":
      return opportunity.customer.companyName;
    case "opportunityName":
      return opportunity.name;
    case "productLines":
      return opportunity.productLines.join("、");
    case "amount":
      return opportunity.amount === null
        ? ""
        : formatAmount(opportunity.amount, opportunity.currency);
    case "stage":
      return STAGE_LABEL[opportunity.stage];
    case "status":
      return STATUS_LABEL[opportunity.status];
    case "winRate":
      return `${getEffectiveWinRate(opportunity)}%${opportunity.winRate !== null ? "（手动）" : ""}`;
    case "expectedCloseDate":
      return opportunity.expectedCloseDate ?? "";
    case "nextAction":
      return opportunity.nextAction ?? "";
    case "nextActionDate":
      return opportunity.nextActionDate ?? "";
    case "lastContactAt":
      return opportunity.lastContactAt?.slice(0, 10) ?? "";
    case "painPoints":
      return opportunity.painPoints ?? "";
    case "needs":
      return opportunity.needs ?? "";
    case "keyInfo":
      return opportunity.keyInfo ?? "";
    case "lossReason":
      return opportunity.lossReason ?? "";
    case "onHoldUntil":
      return opportunity.onHoldUntil ?? "";
    case "industry":
      return opportunity.customer.industry ?? "";
    case "companySize":
      return opportunity.customer.companySize ?? "";
    case "hqCity":
      return opportunity.customer.hqCity ?? "";
    case "website":
      return opportunity.customer.website ?? "";
    case "currentVendor":
      return opportunity.customer.currentVendor ?? "";
    case "source":
      return SOURCE_LABEL[opportunity.customer.source];
    case "sourceDate":
      return opportunity.customer.sourceDate ?? "";
    case "primaryContact":
      return contact?.name ?? "";
    case "contactTitle":
      return contact?.title ?? "";
    case "contactDepartment":
      return contact?.department ?? "";
    case "phone":
      return contact?.phone ?? "";
    case "wechat":
      return contact?.wechat ?? "";
    case "email":
      return contact?.email ?? "";
  }
}

export function OpportunityTableView({
  opportunities,
  today,
}: {
  opportunities: OpportunityWithDetails[];
  today: string;
}) {
  const { preset, customFields, visibleFields, changePreset, toggleCustomField } =
    useTableFieldPreferences<ColumnKey, PresetKey>({
      fixedField: "customerName",
      allCustomFields: CUSTOM_FIELDS,
      presets: PRESETS,
      presetValues: PRESET_VALUES,
      defaultPreset: "default",
      customPreset: "custom",
      presetStorageKey: "salesup:opportunities:table-preset",
      customFieldsStorageKey: "salesup:opportunities:table-custom-fields",
    });
  const fields = useMemo(() => visibleFields, [visibleFields]);
  const exportCsv = () =>
    downloadCsv({
      filename: "商机看板.csv",
      headers: fields.map((field) => COLUMN_LABEL[field]),
      rows: opportunities.map((opportunity) => fields.map((field) => csvValue(field, opportunity))),
    });
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <span className="text-xs text-muted-foreground">
          当前筛选{" "}
          <span className="font-semibold text-foreground tabular-nums">{opportunities.length}</span>{" "}
          个商机
        </span>
        <TableFieldControls
          preset={preset}
          presets={PRESET_OPTIONS}
          customPreset="custom"
          fields={CUSTOM_FIELDS.map((key) => ({ key, label: COLUMN_LABEL[key] }))}
          customFields={customFields}
          fixedFieldLabel="所属客户"
          onPresetChange={(value) => changePreset(value as PresetKey)}
          onToggleField={(field) => toggleCustomField(field as ColumnKey)}
          onExport={exportCsv}
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map((field) => (
                <TableHead key={field} className="whitespace-nowrap text-xs">
                  {COLUMN_LABEL[field]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={fields.length}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  暂无匹配的商机
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opportunity) => (
                <TableRow key={opportunity.id}>
                  {fields.map((field) => (
                    <TableCell key={field} className="max-w-72 text-xs">
                      <Cell field={field} opportunity={opportunity} today={today} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
