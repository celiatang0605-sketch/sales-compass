import { CalendarClock, Timer } from "lucide-react";
import {
  isStale,
  STAGE_COLOR_TOKEN,
  STAGE_LABEL,
  STAGE_ORDER,
  STAGE_STALE_DAYS,
  type Customer,
} from "@/lib/salesup/customerTypes";
import { cn } from "@/lib/utils";

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    const wan = amount / 10000;
    return `¥${wan % 1 === 0 ? wan : wan.toFixed(1)} 万`;
  }
  return `¥${amount.toLocaleString("zh-CN")}`;
}

function AlertPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
}) {
  const active = value > 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
        active
          ? "border-warning-border bg-warning-bg font-medium text-warning"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** 仅根据传入的当前展示客户集合派生的视图头部。 */
export function CustomerViewSummary({
  customers,
  today,
}: {
  customers: Customer[];
  today: string;
}) {
  const overdueFollowups = customers.filter(
    (customer) =>
      !!customer.nextAction && !!customer.nextActionDate && customer.nextActionDate < today,
  ).length;
  const stalled = customers.filter(isStale).length;
  const totalAmount = customers.reduce((total, customer) => total + (customer.amount ?? 0), 0);
  const maxCount = Math.max(
    1,
    ...STAGE_ORDER.map((stage) => customers.filter((customer) => customer.stage === stage).length),
  );

  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AlertPill icon={CalendarClock} label="逾期跟进" value={overdueFollowups} />
        <AlertPill icon={Timer} label="停滞" value={stalled} />
        <div className="ml-auto text-xs text-muted-foreground">
          共 <span className="font-semibold text-foreground tabular-nums">{customers.length}</span>{" "}
          家<span className="mx-1.5">·</span>
          合计{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatAmount(totalAmount)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {STAGE_ORDER.map((stage) => {
          const stageCustomers = customers.filter((customer) => customer.stage === stage);
          const amount = stageCustomers.reduce(
            (total, customer) => total + (customer.amount ?? 0),
            0,
          );
          const hasAmount = stageCustomers.some((customer) => customer.amount !== null);
          const colorToken = STAGE_COLOR_TOKEN[stage];
          const threshold = STAGE_STALE_DAYS[stage];
          const isSigned = stage === "signed";
          return (
            <div
              key={stage}
              className={cn(
                "rounded-xl border bg-card px-3 py-2.5 transition hover:shadow-sm",
                stageCustomers.length === 0 && "opacity-60",
                isSigned ? "border-won/30 bg-won/5" : "border-border",
              )}
            >
              <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${colorToken})` }}
                />
                <span className="truncate">{STAGE_LABEL[stage]}</span>
              </div>
              <div className="mt-1 text-2xl font-semibold leading-none tabular-nums">
                {stageCustomers.length}
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
                {hasAmount ? formatAmount(amount) : "金额待定"}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/70">
                {threshold === null ? "不判停滞" : `阈值 ${threshold} 天`}
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-border/70">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(stageCustomers.length / maxCount) * 100}%`,
                    backgroundColor: `var(${colorToken})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
