import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, LayoutGrid, Plus, Star, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { todayKey } from "@/lib/salesup/date";
import { useCustomers } from "@/lib/salesup/useCustomers";
import { upsertEntry } from "@/lib/salesup/storage";
import type { EntryQuadrant, EntryType } from "@/lib/salesup/types";

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: "progress", label: "进展" },
  { value: "pitfall", label: "踩坑" },
  { value: "note", label: "注意" },
  { value: "todo", label: "待办" },
  { value: "idea", label: "想法" },
];

const QUADRANTS: { value: EntryQuadrant; label: string }[] = [
  { value: "q1", label: "重要且紧急" },
  { value: "q2", label: "重要不紧急" },
  { value: "q3", label: "紧急不重要" },
  { value: "q4", label: "不重要不紧急" },
];

type OptionalField = "customer" | "dueDate" | "quadrant";

export function QuickCapture({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const { customers, loading: customersLoading } = useCustomers();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState("");
  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [quadrant, setQuadrant] = useState<EntryQuadrant | null>(null);
  const [focusToday, setFocusToday] = useState(false);
  const [activeOptional, setActiveOptional] = useState<OptionalField | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setContent("");
    setEntryType(null);
    setCustomerId(null);
    setDueDate(null);
    setQuadrant(null);
    setFocusToday(false);
    setActiveOptional(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open) return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isMobile, open]);

  const resizeDesktopInput = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 200 ? "auto" : "hidden";
  };

  const save = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("请先写下内容");
      inputRef.current?.focus();
      return;
    }
    try {
      upsertEntry({
        content: trimmed,
        entry_type: isMobile ? "note" : (entryType ?? "note"),
        entry_date: todayKey(),
        quadrant: isMobile ? null : quadrant,
        focus_date: !isMobile && focusToday ? todayKey() : null,
        due_date: isMobile ? null : dueDate,
        status: "open",
        customer_id: isMobile ? null : customerId,
        opportunity_id: null,
        related_block_id: null,
        tags: [],
        position: 0,
      });
      toast.success("已记录");
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试");
    }
  };

  const toggleOptional = (field: OptionalField) => {
    setActiveOptional((current) => (current === field ? null : field));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:hidden"
        aria-label="快速捕获"
      >
        <Plus className="h-5 w-5" />
      </button>

      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <AlertDialogContent className="h-svh max-h-none w-full max-w-none gap-0 border-0 bg-card p-0 sm:rounded-none md:h-auto md:max-w-xl md:rounded-xl md:border">
          <AlertDialogTitle className="sr-only">快速捕获</AlertDialogTitle>
          {isMobile ? (
            <MobileCapture
              content={content}
              error={error}
              inputRef={inputRef}
              onChange={(value) => {
                setContent(value);
                setError(null);
              }}
              onClose={close}
              onSave={save}
            />
          ) : (
            <DesktopCapture
              activeOptional={activeOptional}
              content={content}
              customerId={customerId}
              customers={customers}
              customersLoading={customersLoading}
              dueDate={dueDate}
              entryType={entryType}
              error={error}
              focusToday={focusToday}
              inputRef={inputRef}
              quadrant={quadrant}
              onChange={(value, textarea) => {
                setContent(value);
                setError(null);
                resizeDesktopInput(textarea);
              }}
              onEntryTypeChange={(type) =>
                setEntryType((current) => (current === type ? null : type))
              }
              onFocusTodayChange={setFocusToday}
              onOptionalToggle={toggleOptional}
              onCustomerChange={setCustomerId}
              onDueDateChange={setDueDate}
              onQuadrantChange={setQuadrant}
              onSave={save}
            />
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DesktopCapture({
  activeOptional,
  content,
  customerId,
  customers,
  customersLoading,
  dueDate,
  entryType,
  error,
  focusToday,
  inputRef,
  quadrant,
  onChange,
  onCustomerChange,
  onDueDateChange,
  onEntryTypeChange,
  onFocusTodayChange,
  onOptionalToggle,
  onQuadrantChange,
  onSave,
}: {
  activeOptional: OptionalField | null;
  content: string;
  customerId: string | null;
  customers: { id: string; companyName: string }[];
  customersLoading: boolean;
  dueDate: string | null;
  entryType: EntryType | null;
  error: string | null;
  focusToday: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  quadrant: EntryQuadrant | null;
  onChange: (value: string, textarea: HTMLTextAreaElement) => void;
  onCustomerChange: (value: string | null) => void;
  onDueDateChange: (value: string | null) => void;
  onEntryTypeChange: (value: EntryType) => void;
  onFocusTodayChange: (checked: boolean) => void;
  onOptionalToggle: (field: OptionalField) => void;
  onQuadrantChange: (value: EntryQuadrant) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4 p-5">
      <textarea
        ref={inputRef}
        rows={1}
        value={content}
        onChange={(event) => onChange(event.target.value, event.target)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            onSave();
          }
        }}
        placeholder="记点什么…"
        className="block max-h-[200px] min-h-7 w-full resize-none overflow-hidden bg-transparent p-0 text-base leading-7 outline-none placeholder:text-muted-foreground"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {ENTRY_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            aria-pressed={entryType === type.value}
            onClick={() => onEntryTypeChange(type.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              entryType === type.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OptionalButton
          active={activeOptional === "customer"}
          icon={Users}
          label="关联客户"
          onClick={() => onOptionalToggle("customer")}
        />
        <OptionalButton
          active={activeOptional === "dueDate"}
          icon={CalendarDays}
          label="截止日"
          onClick={() => onOptionalToggle("dueDate")}
        />
        <OptionalButton
          active={activeOptional === "quadrant"}
          icon={LayoutGrid}
          label="象限"
          onClick={() => onOptionalToggle("quadrant")}
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Star className="h-3.5 w-3.5" />
          今日重点
          <Switch checked={focusToday} onCheckedChange={onFocusTodayChange} />
        </label>
      </div>

      {activeOptional === "customer" && (
        <div className="rounded-lg border border-border bg-background p-3">
          <label
            className="block text-xs font-medium text-foreground/80"
            htmlFor="quick-capture-customer"
          >
            关联客户
          </label>
          <select
            id="quick-capture-customer"
            value={customerId ?? ""}
            onChange={(event) => onCustomerChange(event.target.value || null)}
            className="mt-2 h-9 w-full rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-ring"
          >
            <option value="">不关联客户</option>
            {customersLoading ? (
              <option disabled>正在加载客户…</option>
            ) : (
              customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {activeOptional === "dueDate" && (
        <div className="rounded-lg border border-border bg-background p-3">
          <label
            className="block text-xs font-medium text-foreground/80"
            htmlFor="quick-capture-due-date"
          >
            截止日
          </label>
          <input
            id="quick-capture-due-date"
            type="date"
            value={dueDate ?? ""}
            onChange={(event) => onDueDateChange(event.target.value || null)}
            className="mt-2 h-9 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-ring"
          />
        </div>
      )}

      {activeOptional === "quadrant" && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3">
          {QUADRANTS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={quadrant === item.value}
              onClick={() => onQuadrantChange(item.value)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                quadrant === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>未选类型时默认存为「注意」</span>
        <span className="shrink-0">Ctrl+Enter 保存 · Esc 关闭</span>
      </div>
    </div>
  );
}

function MobileCapture({
  content,
  error,
  inputRef,
  onChange,
  onClose,
  onSave,
}: {
  content: string;
  error: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{todayKey()}</span>
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          保存
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <textarea
          ref={inputRef}
          value={content}
          onChange={(event) => onChange(event.target.value)}
          placeholder="记点什么…"
          className="min-h-0 flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-muted-foreground"
        />
        {error && <p className="pt-2 text-xs text-destructive">{error}</p>}
      </div>
      <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        存为「待整理」，回电脑前再分类
      </footer>
    </div>
  );
}

function OptionalButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Users;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
