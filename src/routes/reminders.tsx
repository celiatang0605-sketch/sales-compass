import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import {
  useReminders,
  upsertReminder,
  deleteReminder,
} from "@/lib/salesup/storage";
import type {
  Reminder,
  ReminderFrequency,
  ReminderPriority,
  ReminderStatus,
  ReminderType,
} from "@/lib/salesup/types";
import { todayKey, weekRangeOf, monthDaysOf } from "@/lib/salesup/date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reminders")({
  head: () => ({ meta: [{ title: "提醒中心 · Sales Up" }] }),
  component: RemindersPage,
});

const TYPE_LABEL: Record<ReminderType, string> = {
  todo: "待办事项",
  problem: "出现的问题",
  note: "注意事项",
};
const FREQ_LABEL: Record<ReminderFrequency, string> = {
  once: "单次",
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
};
const PRIORITY_LABEL: Record<ReminderPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};
const STATUS_LABEL: Record<ReminderStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  done: "已完成",
};

function RemindersPage() {
  const reminders = useReminders();
  const today = todayKey();
  const { days: weekDays } = useMemo(() => weekRangeOf(today), [today]);
  const monthDays = useMemo(() => monthDaysOf(today), [today]);

  const todayItems = reminders.filter((r) => matchesToday(r, today));
  const weekItems = reminders.filter(
    (r) => matchesWeek(r, weekDays) && !matchesToday(r, today),
  );
  const monthItems = reminders.filter(
    (r) =>
      matchesMonth(r, monthDays) &&
      !matchesWeek(r, weekDays) &&
      !matchesToday(r, today),
  );
  const others = reminders.filter(
    (r) =>
      !matchesToday(r, today) &&
      !matchesWeek(r, weekDays) &&
      !matchesMonth(r, monthDays),
  );

  const [editing, setEditing] = useState<Partial<Reminder> | null>(null);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">提醒中心</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              待办、问题、注意事项与定期提醒
            </p>
          </div>
          <button
            onClick={() => setEditing({ title: "", type: "todo", frequency: "once", priority: "medium", status: "pending" })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> 新增提醒
          </button>
        </div>

        <Group title="今日提醒" items={todayItems} onEdit={setEditing} />
        <Group title="本周提醒" items={weekItems} onEdit={setEditing} />
        <Group title="本月提醒" items={monthItems} onEdit={setEditing} />
        {others.length > 0 && <Group title="其它" items={others} onEdit={setEditing} />}

        {editing && <EditorDialog draft={editing} onClose={() => setEditing(null)} />}
      </div>
    </AppShell>
  );
}

function matchesToday(r: Reminder, today: string) {
  if (r.frequency === "daily") return r.status !== "done";
  return r.related_date === today;
}
function matchesWeek(r: Reminder, weekDays: string[]) {
  if (r.frequency === "weekly") return r.status !== "done";
  return weekDays.includes(r.related_date);
}
function matchesMonth(r: Reminder, monthDays: string[]) {
  if (r.frequency === "monthly") return r.status !== "done";
  return monthDays.includes(r.related_date);
}

function Group({
  title,
  items,
  onEdit,
}: {
  title: string;
  items: Reminder[];
  onEdit: (r: Reminder) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground/80">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length} 条</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-4 text-xs text-muted-foreground">
          暂无{title}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <ReminderItem key={r.id} reminder={r} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReminderItem({
  reminder,
  onEdit,
}: {
  reminder: Reminder;
  onEdit: (r: Reminder) => void;
}) {
  const priorityColor =
    reminder.priority === "high"
      ? "var(--destructive)"
      : reminder.priority === "medium"
        ? "var(--primary)"
        : "var(--muted-foreground)";
  const isDone = reminder.status === "done";
  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-card p-3 flex items-start gap-3 transition-opacity",
        isDone && "opacity-60",
      )}
    >
      <button
        onClick={() =>
          upsertReminder({
            id: reminder.id,
            title: reminder.title,
            status: isDone ? "pending" : "done",
          })
        }
        className={cn(
          "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
          isDone ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-foreground/40",
        )}
        aria-label={isDone ? "标记为未完成" : "标记为已完成"}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>
      <button
        onClick={() => onEdit(reminder)}
        className="flex-1 text-left"
      >
        <div className={cn("text-sm font-medium", isDone && "line-through")}>
          {reminder.title || "(未命名提醒)"}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
            style={{ background: "color-mix(in oklch, " + priorityColor + " 12%, transparent)", color: priorityColor }}
          >
            优先级 {PRIORITY_LABEL[reminder.priority]}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-secondary">{TYPE_LABEL[reminder.type]}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-secondary">{FREQ_LABEL[reminder.frequency]}</span>
          {reminder.related_date && <span>· {reminder.related_date}</span>}
          {reminder.customer && <span>· @{reminder.customer}</span>}
          <span>· {STATUS_LABEL[reminder.status]}</span>
        </div>
        {reminder.note && (
          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
            {reminder.note}
          </div>
        )}
      </button>
      <button
        onClick={() => deleteReminder(reminder.id)}
        className="p-1.5 text-muted-foreground hover:text-destructive"
        aria-label="删除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

function EditorDialog({
  draft,
  onClose,
}: {
  draft: Partial<Reminder>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Reminder>>(draft);
  const update = <K extends keyof Reminder>(k: K, v: Reminder[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.title?.trim()) return;
    upsertReminder({ ...(form as Reminder), title: form.title!.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">
          {form.id ? "编辑提醒" : "新建提醒"}
        </div>
        <div className="p-4 space-y-3">
          <FormField label="标题">
            <input className="rinput" value={form.title ?? ""} onChange={(e) => update("title", e.target.value)} autoFocus />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="提醒类型">
              <select className="rinput" value={form.type} onChange={(e) => update("type", e.target.value as ReminderType)}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FormField>
            <FormField label="提醒频率">
              <select className="rinput" value={form.frequency} onChange={(e) => update("frequency", e.target.value as ReminderFrequency)}>
                {Object.entries(FREQ_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FormField>
            <FormField label="关联日期">
              <input type="date" className="rinput" value={form.related_date ?? ""} onChange={(e) => update("related_date", e.target.value)} />
            </FormField>
            <FormField label="关联客户">
              <input className="rinput" value={form.customer ?? ""} onChange={(e) => update("customer", e.target.value)} />
            </FormField>
            <FormField label="优先级">
              <select className="rinput" value={form.priority} onChange={(e) => update("priority", e.target.value as ReminderPriority)}>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FormField>
            <FormField label="状态">
              <select className="rinput" value={form.status} onChange={(e) => update("status", e.target.value as ReminderStatus)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="备注">
            <textarea className="rinput min-h-[70px] resize-y" value={form.note ?? ""} onChange={(e) => update("note", e.target.value)} />
          </FormField>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-md text-sm hover:bg-secondary">取消</button>
          <button onClick={save} className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90">
            保存
          </button>
        </div>
      </div>
      <style>{`
        .rinput {
          width: 100%;
          padding: 8px 10px;
          font-size: 13px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          color: var(--color-foreground);
          outline: none;
        }
        .rinput:focus { border-color: var(--color-ring); }
      `}</style>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-1">{label}</div>
      {children}
    </div>
  );
}
