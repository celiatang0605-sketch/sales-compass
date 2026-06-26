import { useEffect, useState } from "react";
import { X, Trash2, Bell } from "lucide-react";
import type { TimeBlock, ValueLevel } from "@/lib/salesup/types";
import { WORK_TYPES, WORK_TYPE_MAP, type WorkTypeId } from "@/lib/salesup/workTypes";
import {
  slotToTimeString,
  timeStringToSlot,
  TOTAL_SLOTS,
  slotsDuration,
  formatDuration,
  formatDateLabel,
} from "@/lib/salesup/date";
import {
  deleteTimeBlock,
  upsertTimeBlock,
  upsertReminder,
} from "@/lib/salesup/storage";
import { cn } from "@/lib/utils";

export interface DraftBlock {
  id?: string;
  date: string;
  start_slot: number;
  end_slot: number;
  work_type: WorkTypeId;
  title: string;
  customer: string;
  summary: string;
  key_info: string;
  next_action: string;
  next_action_date: string;
  problem_tags: string[];
  notes: string;
  value_level: ValueLevel;
}

interface Props {
  draft: DraftBlock | null;
  lightweight?: boolean;
  embedded?: boolean;
  onClose: () => void;
}

export function BlockDetailPanel({ draft, lightweight = false, embedded = false, onClose }: Props) {
  const [form, setForm] = useState<DraftBlock | null>(draft);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setForm(draft);
    setTagInput("");
  }, [draft]);

  if (!form) {
    if (embedded) {
      return (
        <div className="hidden md:flex h-full items-center justify-center text-xs text-muted-foreground bg-card rounded-xl border border-border p-6 text-center">
          点击时间块或选中工作类型在时间轴上涂色，详情会显示在这里
        </div>
      );
    }
    return null;
  }

  const update = <K extends keyof DraftBlock>(k: K, v: DraftBlock[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleSave = () => {
    if (form.end_slot <= form.start_slot) return;
    upsertTimeBlock(form as TimeBlock);
    onClose();
  };

  const handleDelete = () => {
    if (form.id) deleteTimeBlock(form.id);
    onClose();
  };

  const handleGenerateReminder = () => {
    if (!form.next_action.trim()) return;
    upsertReminder({
      title: form.next_action.trim(),
      type: "todo",
      frequency: "once",
      related_date: form.next_action_date || form.date,
      customer: form.customer,
      related_block_id: form.id ?? null,
      priority: form.value_level === "high" ? "high" : "medium",
      status: "pending",
      note: form.summary,
    });
  };

  const duration = formatDuration(slotsDuration(form.start_slot, form.end_slot));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.problem_tags.includes(t)) update("problem_tags", [...form.problem_tags, t]);
    setTagInput("");
  };

  return (
    <>
      {!embedded && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "bg-card border-border flex flex-col",
          embedded
            ? // Embedded: desktop sticky rail, mobile bottom sheet
              "fixed inset-x-0 bottom-0 top-auto z-50 border-t shadow-xl max-h-[85vh] rounded-t-2xl " +
              "md:static md:inset-auto md:max-h-none md:rounded-xl md:border md:shadow-none md:h-full"
            : // Default fixed sheet
              "fixed shadow-xl z-50 inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0 md:left-auto md:w-[420px] md:border-l",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="text-sm font-semibold">
              {form.id ? "编辑时间段" : "新建时间段"}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateLabel(form.date)} · {slotToTimeString(form.start_slot)} – {slotToTimeString(form.end_slot)} · {duration}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <TimeField
              label="开始时间"
              value={slotToTimeString(form.start_slot)}
              onChange={(v) => {
                const s = Math.round(timeStringToSlot(v));
                if (s >= 0 && s < form.end_slot) update("start_slot", s);
              }}
            />
            <TimeField
              label="结束时间"
              value={slotToTimeString(form.end_slot)}
              onChange={(v) => {
                const e = Math.round(timeStringToSlot(v));
                if (e <= TOTAL_SLOTS && e > form.start_slot) update("end_slot", e);
              }}
            />
          </div>

          {/* Work type */}
          <Field label="工作类型">
            <div className="flex flex-wrap gap-1.5">
              {WORK_TYPES.map((wt) => (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => update("work_type", wt.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                    form.work_type === wt.id
                      ? "border-foreground/50 bg-secondary"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: `var(${wt.colorVar})` }}
                  />
                  {wt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {WORK_TYPE_MAP[form.work_type]?.description}
            </p>
          </Field>

          <Field label="标题">
            <input
              className="input"
              placeholder="一句话描述这段时间"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </Field>

          {!lightweight && (
            <Field label="关联客户">
              <input
                className="input"
                placeholder="客户名称"
                value={form.customer}
                onChange={(e) => update("customer", e.target.value)}
              />
            </Field>
          )}

          {!lightweight && (
            <Field label="价值等级">
              <div className="flex gap-1.5">
                {(["high", "medium", "low"] as ValueLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => update("value_level", lvl)}
                    className={cn(
                      "flex-1 py-1.5 text-xs rounded-md border transition-colors",
                      form.value_level === lvl
                        ? lvl === "high"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary border-foreground/30"
                        : "border-border hover:bg-secondary/60",
                    )}
                  >
                    {lvl === "high" ? "高价值" : lvl === "medium" ? "中价值" : "低价值"}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="简短记录 (MM / Summary)">
            <textarea
              className="input min-h-[88px] resize-y"
              placeholder={lightweight ? "简短记录这段时间的要点…" : "会议重点、客户反馈、内部同步结论或个人观察…"}
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
            />
          </Field>

          {!lightweight && (
            <>
              <Field label="关键信息">
                <textarea
                  className="input min-h-[60px] resize-y"
                  placeholder="关键数据、关键决策、关键人"
                  value={form.key_info}
                  onChange={(e) => update("key_info", e.target.value)}
                />
              </Field>

              <Field label="下一步动作">
                <textarea
                  className="input min-h-[60px] resize-y"
                  placeholder="接下来要做什么"
                  value={form.next_action}
                  onChange={(e) => update("next_action", e.target.value)}
                />
              </Field>

              <Field label="待办日期">
                <input
                  type="date"
                  className="input"
                  value={form.next_action_date}
                  onChange={(e) => update("next_action_date", e.target.value)}
                />
              </Field>

              <Field label="问题标签">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="按回车添加，例如：报价偏高"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 rounded-md border border-border text-xs hover:bg-secondary"
                  >
                    添加
                  </button>
                </div>
                {form.problem_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.problem_tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive"
                      >
                        {t}
                        <button
                          onClick={() =>
                            update(
                              "problem_tags",
                              form.problem_tags.filter((x) => x !== t),
                            )
                          }
                          className="hover:text-destructive/70"
                          aria-label="移除"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </>
          )}

          {!lightweight && (
            <Field label="注意事项">
              <textarea
                className="input min-h-[60px] resize-y"
                placeholder="需要留意的细节，例如客户偏好、合规要求"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </Field>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex items-center gap-2 bg-card">
          {form.id && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 rounded-md text-destructive hover:bg-destructive/10"
              aria-label="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {form.next_action.trim() && (
            <button
              type="button"
              onClick={handleGenerateReminder}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border border-border hover:bg-secondary"
              title="把下一步动作生成为提醒"
            >
              <Bell className="w-3.5 h-3.5" />
              生成提醒
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md text-sm hover:bg-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90"
          >
            保存
          </button>
        </div>
      </aside>

      <style>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          font-size: 13px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          color: var(--color-foreground);
          outline: none;
        }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-ring) 25%, transparent); }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-1.5">{label}</div>
      <input
        type="time"
        step={900}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
