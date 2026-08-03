import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
  Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { changeCustomerStage, updateCustomer } from "@/lib/salesup/customerRepository";
import {
  getEffectiveWinRate,
  isStale,
  ROLE_LABEL,
  SOURCE_LABEL,
  STAGE_COLOR_TOKEN,
  STAGE_LABEL,
  STATUS_LABEL,
  staleDays,
  type Customer,
  type CustomerStage,
  type CustomerStatus,
  STAGE_ORDER,
} from "@/lib/salesup/customerTypes";
import { useStageSettings } from "@/lib/salesup/stageSettings";
import { downloadCsv } from "@/lib/salesup/csv";
import { useTableFieldPreferences } from "@/lib/salesup/tableFields";
import { TableFieldControls } from "@/components/salesup/table/TableFieldControls";

type ColumnKey =
  | "companyName"
  | "stage"
  | "staleDays"
  | "nextAction"
  | "nextActionDate"
  | "contactName"
  | "amount"
  | "productLines"
  | "winRate"
  | "expectedCloseDate"
  | "status"
  | "industry"
  | "overseasMarkets"
  | "companySize"
  | "hqCity"
  | "currentVendor"
  | "contactTitle"
  | "decisionRole"
  | "phone"
  | "wechat"
  | "email"
  | "source"
  | "sourceDetail"
  | "sourceDate";

type PresetKey = "followup" | "opportunity" | "profile" | "contacts" | "source" | "custom";
type StatusFilter = CustomerStatus | "all";
type SortDirection = "asc" | "desc";
type CustomizableColumnKey = Exclude<ColumnKey, "companyName">;
type BulkAction = "hold" | "lost" | "stage";
type BulkStep = "form" | "confirm" | "result";

interface BulkResult {
  succeeded: number;
  failures: Array<{ companyName: string; message: string }>;
}

const CUSTOM_FIELDS_STORAGE_KEY = "salesup:customers:table-custom-fields";
const PRESET_STORAGE_KEY = "salesup:customers:table-preset";
const PRESET_VALUES: PresetKey[] = [
  "followup",
  "opportunity",
  "profile",
  "contacts",
  "source",
  "custom",
];

const COLUMN_LABEL: Record<ColumnKey, string> = {
  companyName: "公司名",
  stage: "阶段",
  staleDays: "停滞天数",
  nextAction: "下一步动作",
  nextActionDate: "下一步日期",
  contactName: "主联系人",
  amount: "金额",
  productLines: "产品线",
  winRate: "赢率",
  expectedCloseDate: "预计成交时间",
  status: "状态",
  industry: "行业",
  overseasMarkets: "出海市场",
  companySize: "公司规模",
  hqCity: "总部城市",
  currentVendor: "现有供应商",
  contactTitle: "职位",
  decisionRole: "决策角色",
  phone: "电话",
  wechat: "微信",
  email: "邮箱",
  source: "来源",
  sourceDetail: "来源说明",
  sourceDate: "拿到日期",
};

const PRESETS: Record<Exclude<PresetKey, "custom">, ColumnKey[]> = {
  followup: [
    "companyName",
    "stage",
    "staleDays",
    "nextAction",
    "nextActionDate",
    "contactName",
    "amount",
  ],
  opportunity: [
    "companyName",
    "productLines",
    "stage",
    "winRate",
    "amount",
    "expectedCloseDate",
    "status",
  ],
  profile: ["companyName", "industry", "overseasMarkets", "companySize", "hqCity", "currentVendor"],
  contacts: [
    "companyName",
    "contactName",
    "contactTitle",
    "decisionRole",
    "phone",
    "wechat",
    "email",
  ],
  source: ["companyName", "source", "sourceDetail", "sourceDate", "stage", "staleDays"],
};

const PRESET_LABEL: Record<PresetKey, string> = {
  followup: "跟进视图",
  opportunity: "商机视图",
  profile: "客户档案",
  contacts: "联系人",
  source: "来源分析",
  custom: "自定义",
};

const CUSTOMIZABLE_FIELDS = (Object.keys(COLUMN_LABEL) as ColumnKey[]).filter(
  (field): field is CustomizableColumnKey => field !== "companyName",
);

const CUSTOM_FIELD_OPTIONS = CUSTOMIZABLE_FIELDS.map((key) => ({ key, label: COLUMN_LABEL[key] }));
const PRESET_OPTIONS = (Object.keys(PRESET_LABEL) as PresetKey[]).map((value) => ({
  value,
  label: PRESET_LABEL[value],
}));

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === "CNY" ? "¥" : `${currency} `;
  if (amount >= 10000) {
    const wan = amount / 10000;
    return `${symbol}${wan % 1 === 0 ? wan : wan.toFixed(1)} 万`;
  }
  return `${symbol}${amount.toLocaleString("zh-CN")}`;
}

function displayText(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function sortValue(customer: Customer, field: ColumnKey): string | number {
  switch (field) {
    case "staleDays":
      return staleDays(customer);
    case "amount":
      return customer.amount ?? -1;
    case "winRate":
      return getEffectiveWinRate(customer);
    case "stage":
      return STAGE_LABEL[customer.stage];
    case "status":
      return STATUS_LABEL[customer.status];
    case "decisionRole":
      return ROLE_LABEL[customer.decisionRole];
    case "source":
      return SOURCE_LABEL[customer.source];
    case "productLines":
      return customer.productLines.join(" ");
    case "overseasMarkets":
      return customer.overseasMarkets.join(" ");
    case "companyName":
      return customer.companyName;
    case "nextAction":
      return customer.nextAction ?? "";
    case "nextActionDate":
      return customer.nextActionDate ?? "";
    case "contactName":
      return customer.contactName ?? "";
    case "expectedCloseDate":
      return customer.expectedCloseDate ?? "";
    case "industry":
      return customer.industry ?? "";
    case "companySize":
      return customer.companySize ?? "";
    case "hqCity":
      return customer.hqCity ?? "";
    case "currentVendor":
      return customer.currentVendor ?? "";
    case "contactTitle":
      return customer.contactTitle ?? "";
    case "phone":
      return customer.phone ?? "";
    case "wechat":
      return customer.wechat ?? "";
    case "email":
      return customer.email ?? "";
    case "sourceDetail":
      return customer.sourceDetail ?? "";
    case "sourceDate":
      return customer.sourceDate ?? "";
  }
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3" />;
  return direction === "asc" ? (
    <ChevronUp className="h-3 w-3" />
  ) : (
    <ChevronDown className="h-3 w-3" />
  );
}

function StaleDays({
  customer,
  thresholds,
}: {
  customer: Customer;
  thresholds: Parameters<typeof isStale>[1];
}) {
  if (thresholds[customer.stage] === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const stale = isStale(customer, thresholds);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs tabular-nums",
        stale ? "bg-warning-bg font-medium text-warning" : "text-muted-foreground",
      )}
    >
      {stale && <AlertTriangle className="h-3 w-3" />}
      {stale ? `停滞 ${staleDays(customer)} 天` : `${staleDays(customer)} 天`}
    </span>
  );
}

function CellContent({
  field,
  customer,
  today,
  showNextActionDate,
  thresholds,
}: {
  field: ColumnKey;
  customer: Customer;
  today: string;
  showNextActionDate: boolean;
  thresholds: Parameters<typeof isStale>[1];
}) {
  const overdue =
    !!customer.nextAction && !!customer.nextActionDate && customer.nextActionDate < today;

  switch (field) {
    case "stage": {
      const colorToken = STAGE_COLOR_TOKEN[customer.stage];
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs whitespace-nowrap">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(${colorToken})` }}
          />
          {STAGE_LABEL[customer.stage]}
        </span>
      );
    }
    case "staleDays":
      return <StaleDays customer={customer} thresholds={thresholds} />;
    case "nextActionDate":
      return (
        <span
          className={cn(
            "tabular-nums",
            overdue ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {customer.nextActionDate ?? "—"}
          {overdue ? "（逾期）" : ""}
        </span>
      );
    case "amount":
      return customer.amount === null ? (
        <span className="text-xs text-muted-foreground">金额待定</span>
      ) : (
        <span className="font-semibold text-primary tabular-nums">
          {formatAmount(customer.amount, customer.currency)}
        </span>
      );
    case "productLines":
      return customer.productLines.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {customer.productLines.map((productLine) => (
            <span
              key={productLine}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {productLine}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "winRate": {
      const rate = getEffectiveWinRate(customer);
      return (
        <span className="flex min-w-24 items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-border/70">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </span>
          <span className="flex w-14 items-center justify-end gap-1 text-xs tabular-nums">
            <span className={cn(customer.winRate !== null && "font-semibold")}>{rate}%</span>
            {customer.winRate !== null && (
              <span className="rounded border border-primary/30 bg-primary/5 px-1 py-px text-[9px] font-medium text-primary">
                手动
              </span>
            )}
          </span>
        </span>
      );
    }
    case "status":
      return <span>{STATUS_LABEL[customer.status]}</span>;
    case "overseasMarkets":
      return displayText(customer.overseasMarkets.join("、"));
    case "decisionRole":
      return ROLE_LABEL[customer.decisionRole];
    case "source":
      return (
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {SOURCE_LABEL[customer.source]}
        </span>
      );
    case "companyName":
      return (
        <span className="block min-w-44">
          <span className="block truncate text-[13.5px] font-semibold leading-5">
            {customer.companyName}
          </span>
          <span className="block truncate text-[11.5px] leading-4 text-muted-foreground">
            {customer.contactName ?? "未填联系人"}
            {customer.contactTitle ? ` · ${customer.contactTitle}` : ""}
            {customer.decisionRole !== "unknown" ? ` · ${ROLE_LABEL[customer.decisionRole]}` : ""}
          </span>
        </span>
      );
    case "nextAction":
      return (
        <span className="block min-w-40 whitespace-nowrap text-xs text-muted-foreground">
          <span className="truncate">{displayText(customer.nextAction)}</span>
          {showNextActionDate && customer.nextActionDate && (
            <span
              className={cn(
                "ml-1.5 font-semibold tabular-nums",
                overdue ? "text-overdue" : "text-foreground",
              )}
            >
              {customer.nextActionDate}
              {overdue ? "（逾期）" : ""}
            </span>
          )}
        </span>
      );
    case "contactName":
      return displayText(customer.contactName);
    case "expectedCloseDate":
      return customer.expectedCloseDate ?? "—";
    case "industry":
      return displayText(customer.industry);
    case "companySize":
      return displayText(customer.companySize);
    case "hqCity":
      return displayText(customer.hqCity);
    case "currentVendor":
      return displayText(customer.currentVendor);
    case "contactTitle":
      return displayText(customer.contactTitle);
    case "phone":
      return displayText(customer.phone);
    case "wechat":
      return displayText(customer.wechat);
    case "email":
      return displayText(customer.email);
    case "sourceDetail":
      return displayText(customer.sourceDetail);
    case "sourceDate":
      return customer.sourceDate ?? "—";
  }
}

function csvValue(field: ColumnKey, customer: Customer, today: string): string {
  const overdue =
    !!customer.nextAction && !!customer.nextActionDate && customer.nextActionDate < today;

  switch (field) {
    case "companyName":
      return customer.companyName;
    case "stage":
      return STAGE_LABEL[customer.stage];
    case "staleDays":
      return `停滞 ${staleDays(customer)} 天`;
    case "nextAction":
      return customer.nextAction ?? "";
    case "nextActionDate":
      return customer.nextActionDate
        ? `${customer.nextActionDate}${overdue ? "（逾期）" : ""}`
        : "";
    case "contactName":
      return customer.contactName ?? "";
    case "amount":
      return customer.amount === null ? "" : formatAmount(customer.amount, customer.currency);
    case "productLines":
      return customer.productLines.join("、");
    case "winRate":
      return `${getEffectiveWinRate(customer)}%`;
    case "expectedCloseDate":
      return customer.expectedCloseDate ?? "";
    case "status":
      return STATUS_LABEL[customer.status];
    case "industry":
      return customer.industry ?? "";
    case "overseasMarkets":
      return customer.overseasMarkets.join("、");
    case "companySize":
      return customer.companySize ?? "";
    case "hqCity":
      return customer.hqCity ?? "";
    case "currentVendor":
      return customer.currentVendor ?? "";
    case "contactTitle":
      return customer.contactTitle ?? "";
    case "decisionRole":
      return ROLE_LABEL[customer.decisionRole];
    case "phone":
      return customer.phone ?? "";
    case "wechat":
      return customer.wechat ?? "";
    case "email":
      return customer.email ?? "";
    case "source":
      return SOURCE_LABEL[customer.source];
    case "sourceDetail":
      return customer.sourceDetail ?? "";
    case "sourceDate":
      return customer.sourceDate ?? "";
  }
}

export function CustomerTableView({
  customers,
  today,
  onRefresh,
  onVisibleCustomersChange,
}: {
  customers: Customer[];
  today: string;
  onRefresh: () => Promise<void>;
  onVisibleCustomersChange?: (customers: Customer[]) => void;
}) {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLTableElement>(null);
  const { staleDays: staleThresholds } = useStageSettings();
  const [status, setStatus] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<ColumnKey>("staleDays");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { preset, customFields, visibleFields, changePreset, toggleCustomField } =
    useTableFieldPreferences<ColumnKey, PresetKey>({
      fixedField: "companyName",
      allCustomFields: CUSTOMIZABLE_FIELDS,
      presets: PRESETS,
      presetValues: PRESET_VALUES,
      defaultPreset: "followup",
      customPreset: "custom",
      presetStorageKey: PRESET_STORAGE_KEY,
      customFieldsStorageKey: CUSTOM_FIELDS_STORAGE_KEY,
    });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkStep, setBulkStep] = useState<BulkStep>("form");
  const [wakeDate, setWakeDate] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [targetStage, setTargetStage] = useState<CustomerStage>("opportunity_confirmed");
  const [stageReason, setStageReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = customers.filter((customer) => {
      if (status !== "all" && customer.status !== status) return false;
      if (!normalizedQuery) return true;
      return [customer.companyName, customer.contactName ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      );
    });
    return filtered.sort((a, b) => {
      const left = sortValue(a, sortField);
      const right = sortValue(b, sortField);
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "zh-CN");
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [customers, query, sortDirection, sortField, status]);

  useEffect(() => {
    onVisibleCustomersChange?.(rows);
  }, [onVisibleCustomersChange, rows]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const updateStickyOffsets = () => {
      const selection = table.querySelector<HTMLElement>('[data-sticky-column="selection"]');
      const index = table.querySelector<HTMLElement>('[data-sticky-column="index"]');
      if (!selection || !index) return;
      const selectionWidth = selection.getBoundingClientRect().width;
      const indexWidth = index.getBoundingClientRect().width;
      table.style.setProperty("--sticky-selection-offset", `${selectionWidth}px`);
      table.style.setProperty("--sticky-customer-offset", `${selectionWidth + indexWidth}px`);
    };

    updateStickyOffsets();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateStickyOffsets);
    observer.observe(table);
    return () => observer.disconnect();
  }, [visibleFields]);

  const selectedRows = useMemo(
    () => rows.filter((customer) => selectedIds.has(customer.id)),
    [rows, selectedIds],
  );

  const allRowsSelected = rows.length > 0 && rows.every((customer) => selectedIds.has(customer.id));
  const someRowsSelected = selectedRows.length > 0 && !allRowsSelected;

  useEffect(() => {
    const visibleIds = new Set(rows.map((customer) => customer.id));
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  const changeSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "staleDays" ? "desc" : "asc");
  };

  const toggleRow = (customerId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const toggleAllRows = () => {
    setSelectedIds(allRowsSelected ? new Set() : new Set(rows.map((customer) => customer.id)));
  };

  const openBulkAction = (action: BulkAction) => {
    setBulkAction(action);
    setBulkStep("form");
    setBulkResult(null);
  };

  const closeBulkAction = () => {
    if (processing) return;
    setBulkAction(null);
    setBulkResult(null);
  };

  const actionTitle =
    bulkAction === "hold"
      ? "批量标记暂缓培育"
      : bulkAction === "lost"
        ? "批量标记已丢"
        : "批量推进阶段";

  const canContinueBulkAction =
    bulkAction === "hold" ? !!wakeDate : bulkAction === "lost" ? !!lossReason.trim() : true;

  const runBulkAction = async () => {
    if (!bulkAction || processing || selectedRows.length === 0) return;

    setProcessing(true);
    const result: BulkResult = { succeeded: 0, failures: [] };
    for (const customer of selectedRows) {
      try {
        if (bulkAction === "hold") {
          await updateCustomer(customer.id, { status: "on_hold", onHoldUntil: wakeDate });
        } else if (bulkAction === "lost") {
          await updateCustomer(customer.id, { status: "lost", lossReason: lossReason.trim() });
        } else {
          await changeCustomerStage({
            customerId: customer.id,
            fromStage: customer.stage,
            toStage: targetStage,
            reason: stageReason,
          });
        }
        result.succeeded += 1;
      } catch (error) {
        result.failures.push({
          companyName: customer.companyName,
          message: error instanceof Error ? error.message : "更新失败",
        });
      }
    }

    setSelectedIds(new Set());
    await onRefresh();
    setBulkResult(result);
    setBulkStep("result");
    setProcessing(false);
  };

  const exportCsv = () => {
    downloadCsv({
      filename: `客户看板-${today}.csv`,
      headers: ["序号", ...visibleFields.map((field) => COLUMN_LABEL[field])],
      rows: rows.map((customer, index) => [
        String(index + 1),
        ...visibleFields.map((field) => csvValue(field, customer, today)),
      ]),
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["active", "won", "lost", "on_hold", "all"] as StatusFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={cn(
                "h-7 rounded-full border px-2.5 text-xs transition",
                status === item
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {item === "all" ? "全部" : STATUS_LABEL[item]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索公司或联系人"
              className="h-8 w-44 rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary/60"
            />
          </label>
          <TableFieldControls
            preset={preset}
            presets={PRESET_OPTIONS}
            customPreset="custom"
            fields={CUSTOM_FIELD_OPTIONS}
            customFields={customFields}
            onPresetChange={(nextPreset) => changePreset(nextPreset as PresetKey)}
            onToggleField={(field) => toggleCustomField(field as CustomizableColumnKey)}
            onExport={exportCsv}
          />
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">已选 {selectedRows.length} 条</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => openBulkAction("hold")}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              标记暂缓培育
            </button>
            <button
              type="button"
              onClick={() => openBulkAction("lost")}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              标记已丢
            </button>
            <button
              type="button"
              onClick={() => openBulkAction("stage")}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              推进阶段
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table ref={tableRef} className="min-w-[900px] text-xs">
          <TableHeader>
            <TableRow className="hover:bg-secondary/70">
              <TableHead
                data-sticky-column="selection"
                className="sticky left-0 z-30 w-10 min-w-10 bg-secondary px-2"
              >
                <Checkbox
                  checked={allRowsSelected ? true : someRowsSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAllRows}
                  aria-label="全选当前筛选结果"
                />
              </TableHead>
              <TableHead
                data-sticky-column="index"
                className="sticky left-[var(--sticky-selection-offset)] z-20 w-12 min-w-12 bg-secondary px-2 text-center"
              >
                序号
              </TableHead>
              {visibleFields.map((field) => {
                const sticky = field === "companyName";
                return (
                  <TableHead
                    key={field}
                    className={cn(
                      sticky && "sticky left-[var(--sticky-customer-offset)] z-10 bg-secondary",
                      field === "companyName" && "min-w-44",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => changeSort(field)}
                      className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
                    >
                      {COLUMN_LABEL[field]}
                      <SortIcon active={sortField === field} direction={sortDirection} />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((customer, index) => (
              <TableRow
                key={customer.id}
                role="link"
                tabIndex={0}
                onClick={() => void navigate({ to: "/customers/$id", params: { id: customer.id } })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void navigate({ to: "/customers/$id", params: { id: customer.id } });
                  }
                }}
                className="group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <TableCell
                  data-sticky-column="selection"
                  className="sticky left-0 z-20 w-10 min-w-10 bg-card px-2 py-2 group-hover:bg-muted/50"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(customer.id)}
                    onCheckedChange={() => toggleRow(customer.id)}
                    aria-label={`选择 ${customer.companyName}`}
                  />
                </TableCell>
                <TableCell
                  data-sticky-column="index"
                  className="sticky left-[var(--sticky-selection-offset)] z-20 w-12 min-w-12 bg-card px-2 py-2 text-center text-muted-foreground group-hover:bg-muted/50"
                >
                  {index + 1}
                </TableCell>
                {visibleFields.map((field) => (
                  <TableCell
                    key={field}
                    className={cn(
                      "max-w-64 py-2",
                      field === "companyName" &&
                        "sticky left-[var(--sticky-customer-offset)] z-10 bg-card group-hover:bg-muted/50",
                    )}
                  >
                    <CellContent
                      field={field}
                      customer={customer}
                      today={today}
                      showNextActionDate={
                        field === "nextAction" && !visibleFields.includes("nextActionDate")
                      }
                      thresholds={staleThresholds}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <div className="border-t border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            没有匹配的客户
          </div>
        )}
        <div className="flex items-center border-t border-border bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
          共 <span className="mx-1 font-semibold text-foreground tabular-nums">{rows.length}</span>{" "}
          家<span className="mx-1.5">·</span>
          合计
          <span className="ml-1 font-semibold text-primary tabular-nums">
            {formatAmount(
              rows.reduce((total, customer) => total + (customer.amount ?? 0), 0),
              "CNY",
            )}
          </span>
        </div>
      </div>

      {bulkAction && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeBulkAction();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            {bulkStep === "form" && (
              <>
                <DialogHeader>
                  <DialogTitle>{actionTitle}</DialogTitle>
                  <DialogDescription>
                    将为已选的 {selectedRows.length} 条客户记录应用同一设置。
                  </DialogDescription>
                </DialogHeader>

                {bulkAction === "hold" && (
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">唤醒日期</span>
                    <input
                      type="date"
                      value={wakeDate}
                      onChange={(event) => setWakeDate(event.target.value)}
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
                    />
                  </label>
                )}

                {bulkAction === "lost" && (
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">丢单原因</span>
                    <textarea
                      value={lossReason}
                      onChange={(event) => setLossReason(event.target.value)}
                      rows={4}
                      placeholder="请说明统一的丢单原因"
                      className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                    />
                  </label>
                )}

                {bulkAction === "stage" && (
                  <div className="space-y-4">
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium">目标阶段</span>
                      <select
                        value={targetStage}
                        onChange={(event) => setTargetStage(event.target.value as CustomerStage)}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
                      >
                        {STAGE_ORDER.map((stage) => (
                          <option key={stage} value={stage}>
                            {STAGE_LABEL[stage]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium">推进原因</span>
                      <textarea
                        value={stageReason}
                        onChange={(event) => setStageReason(event.target.value)}
                        rows={4}
                        placeholder="可选，记录本次统一推进的原因"
                        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                      />
                    </label>
                  </div>
                )}

                <DialogFooter>
                  <button
                    type="button"
                    onClick={closeBulkAction}
                    className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={!canContinueBulkAction}
                    onClick={() => setBulkStep("confirm")}
                    className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    继续确认
                  </button>
                </DialogFooter>
              </>
            )}

            {bulkStep === "confirm" && (
              <>
                <DialogHeader>
                  <DialogTitle>确认{actionTitle}</DialogTitle>
                  <DialogDescription>
                    确认后将逐条更新，影响 {selectedRows.length} 条客户记录。
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm">
                  {bulkAction === "hold" && <>统一唤醒日期：{wakeDate}</>}
                  {bulkAction === "lost" && <>统一丢单原因：{lossReason.trim()}</>}
                  {bulkAction === "stage" && (
                    <>
                      统一推进到：{STAGE_LABEL[targetStage]}
                      {stageReason.trim() ? `；原因：${stageReason.trim()}` : ""}
                    </>
                  )}
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => setBulkStep("form")}
                    className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    返回修改
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => void runBulkAction()}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    确认执行
                  </button>
                </DialogFooter>
              </>
            )}

            {bulkStep === "result" && bulkResult && (
              <>
                <DialogHeader>
                  <DialogTitle>批量操作完成</DialogTitle>
                  <DialogDescription>
                    成功 {bulkResult.succeeded} 条，失败 {bulkResult.failures.length} 条。
                  </DialogDescription>
                </DialogHeader>
                {bulkResult.failures.length > 0 && (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {bulkResult.failures.map((failure) => (
                      <div key={`${failure.companyName}-${failure.message}`}>
                        {failure.companyName}：{failure.message}
                      </div>
                    ))}
                  </div>
                )}
                <DialogFooter>
                  <button
                    type="button"
                    onClick={closeBulkAction}
                    className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                  >
                    关闭
                  </button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
