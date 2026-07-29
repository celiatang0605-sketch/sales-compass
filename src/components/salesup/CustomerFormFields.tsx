// 客户看板表单的共用控件：折叠分区、字段、标签输入、下拉。
// 只用 CSS 变量与 Tailwind token，浅色模式。
import { useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, type CustomerSource } from "@/lib/salesup/customerTypes";

export const PRODUCT_LINE_OPTIONS = ["WiseMonitor", "WiseBI", "WiseDiscover", "WisersOne", "GEO"];

export const SOURCE_DETAIL_PLACEHOLDER: Record<CustomerSource, string> = {
  expo: "展会名称，如 2026 广交会",
  marketing_assigned: "分配人姓名",
  list_claimed: "名单批次，如 2026Q1 制造业名单",
  existing_upsell: "原有合作产品 / 合同",
  referral: "推荐人姓名",
  self_developed: "开发渠道，如 LinkedIn",
  other: "补充说明",
};

export function sourceDetailLabel(source: CustomerSource): string {
  return `来源说明（${SOURCE_LABEL[source]}）`;
}

export function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-medium">
          {title}
          {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
        </span>
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
      )}
    </section>
  );
}

export function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full h-9 px-2.5 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:border-primary/60";

export const textareaClass =
  "w-full px-2.5 py-2 rounded-[var(--radius)] border border-border bg-background text-sm outline-none focus:border-primary/60 resize-y";

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-2.5 h-7 rounded-full text-xs border transition",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** 多值标签输入：可从候选里点选，也可以自定义追加。 */
export function TagInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const s = t.trim();
    if (!s || value.includes(s)) return;
    onChange([...value, s]);
  };
  return (
    <div className="space-y-2">
      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <Chip
              key={o}
              active={value.includes(o)}
              onClick={() => (value.includes(o) ? onChange(value.filter((v) => v !== o)) : add(o))}
            >
              {o}
            </Chip>
          ))}
        </div>
      )}
      {value.filter((v) => !options?.includes(v)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value
            .filter((v) => !options?.includes(v))
            .map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-2 h-7 rounded-full text-xs bg-secondary text-secondary-foreground"
              >
                {v}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== v))}
                  aria-label={`移除 ${v}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          placeholder={placeholder ?? "输入后回车追加"}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          className="shrink-0 h-9 px-3 rounded-[var(--radius)] border border-border text-xs hover:bg-muted"
        >
          添加
        </button>
      </div>
    </div>
  );
}
