import { useEffect, useRef, useState } from "react";
import { X, Trash2, Bell, ChevronDown, Check, Clock3 } from "lucide-react";
import type { TimeBlock, ValueLevel } from "@/lib/salesup/types";
import { useCustomers } from "@/lib/salesup/useCustomers";
import { STAGE_LABEL } from "@/lib/salesup/customerTypes";
import { type WorkTypeId } from "@/lib/salesup/workTypes";
import {
  getEffectiveWorkTypes,
  resolveWorkType,
  useWorkTypeSettings,
} from "@/lib/salesup/workTypeSettings";
import {
  slotToTimeString,
  TOTAL_SLOTS,
  SLOT_MINUTES,
  SLOTS_PER_HOUR,
  slotsDuration,
  formatDuration,
  formatDateLabel,
} from "@/lib/salesup/date";
import { deleteTimeBlock, upsertTimeBlock, upsertReminder } from "@/lib/salesup/storage";
import { cn } from "@/lib/utils";

export interface DraftBlock {
  id?: string;
  date: string;
  start_slot: number;
  end_slot: number;
  work_type: WorkTypeId;
  title: string;
  customer: string;
  /** 选中客户看板里的客户时写入 customers.id；自由文本时为 null。 */
  customer_id?: string | null;
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
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [timeErrors, setTimeErrors] = useState<{ start?: string; end?: string }>({});
  const [endManuallyEdited, setEndManuallyEdited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);
  const { settings } = useWorkTypeSettings();
  const effectiveTypes = getEffectiveWorkTypes(settings);

  useEffect(() => {
    setForm(draft);
    setTagInput("");
    setStartInput(draft ? slotToTimeString(draft.start_slot) : "");
    setEndInput(draft ? slotToTimeString(draft.end_slot) : "");
    setTimeErrors({});
    setEndManuallyEdited(false);
    setIsSaving(false);
    savingRef.current = false;
  }, [draft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!form || event.key !== "Escape" || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [form, onClose]);

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

  const focusTimeInput = (field: "start" | "end") => {
    window.requestAnimationFrame(() =>
      (field === "start" ? startInputRef : endInputRef).current?.focus(),
    );
  };

  const handleSave = (timeSource?: "start" | "end", inputOverride?: string) => {
    if (isSaving || savingRef.current) return;
    const startTime = completeTimeForSave(
      timeSource === "start" && inputOverride !== undefined ? inputOverride : startInput,
    );
    const endTime = completeTimeForSave(
      timeSource === "end" && inputOverride !== undefined ? inputOverride : endInput,
    );
    const parsedStart = parseTimeSlot(startTime);
    const parsedEnd = parseTimeSlot(endTime);

    if (typeof parsedStart === "string" || parsedStart >= TOTAL_SLOTS) {
      setTimeErrors({
        start: typeof parsedStart === "string" ? parsedStart : "开始时间需早于 24:00",
      });
      focusTimeInput("start");
      return;
    }
    if (typeof parsedEnd === "string" || parsedEnd > TOTAL_SLOTS) {
      setTimeErrors({ end: typeof parsedEnd === "string" ? parsedEnd : "结束时间不能晚于 24:00" });
      focusTimeInput("end");
      return;
    }

    const shouldKeepDuration = !endManuallyEdited && parsedStart !== form.start_slot;
    const endSlot = shouldKeepDuration
      ? parsedStart + (form.end_slot - form.start_slot)
      : parsedEnd;
    if (endSlot > TOTAL_SLOTS) {
      setTimeErrors({ start: "保持时长后不能晚于 24:00" });
      focusTimeInput("start");
      return;
    }
    if (endSlot <= parsedStart) {
      setTimeErrors({ end: "结束时间必须晚于开始时间" });
      focusTimeInput("end");
      return;
    }

    const saved = { ...form, start_slot: parsedStart, end_slot: endSlot };
    setStartInput(slotToTimeString(parsedStart));
    setEndInput(slotToTimeString(endSlot));
    setTimeErrors({});
    savingRef.current = true;
    setIsSaving(true);
    upsertTimeBlock(saved as TimeBlock);
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

  const setTimeError = (field: "start" | "end", message?: string) =>
    setTimeErrors((current) => ({ ...current, [field]: message }));

  const applyStartTime = (raw: string, formatInput = true) => {
    const parsed = parseTimeSlot(raw);
    if (typeof parsed === "string") {
      setTimeError("start", parsed);
      return;
    }
    if (parsed >= TOTAL_SLOTS) {
      setTimeError("start", "开始时间需早于 24:00");
      return;
    }
    const durationSlots = form.end_slot - form.start_slot;
    if (!endManuallyEdited) {
      const endSlot = parsed + durationSlots;
      if (endSlot > TOTAL_SLOTS) {
        setTimeError("start", "保持时长后不能晚于 24:00");
        return;
      }
      update("start_slot", parsed);
      update("end_slot", endSlot);
      if (formatInput) setStartInput(slotToTimeString(parsed));
      setEndInput(slotToTimeString(endSlot));
    } else {
      if (parsed >= form.end_slot) {
        setTimeError("start", "开始时间必须早于结束时间");
        return;
      }
      update("start_slot", parsed);
      if (formatInput) setStartInput(slotToTimeString(parsed));
    }
    setTimeError("start");
  };

  const applyEndTime = (raw: string, formatInput = true) => {
    const parsed = parseTimeSlot(raw);
    if (typeof parsed === "string") {
      setTimeError("end", parsed);
      return;
    }
    if (parsed > TOTAL_SLOTS) {
      setTimeError("end", "结束时间不能晚于 24:00");
      return;
    }
    if (parsed <= form.start_slot) {
      setTimeError("end", "结束时间必须晚于开始时间");
      return;
    }
    update("end_slot", parsed);
    if (formatInput) setEndInput(slotToTimeString(parsed));
    setEndManuallyEdited(true);
    setTimeError("end");
  };

  const stepStartTime = (direction: 1 | -1, amount: number) => {
    const next = form.start_slot + direction * amount;
    if (next < 0 || next >= TOTAL_SLOTS) return;
    applyStartTime(slotToTimeString(next));
  };

  const stepEndTime = (direction: 1 | -1, amount: number) => {
    const next = form.end_slot + direction * amount;
    if (next <= 0 || next > TOTAL_SLOTS) return;
    applyEndTime(slotToTimeString(next));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.problem_tags.includes(t)) update("problem_tags", [...form.problem_tags, t]);
    setTagInput("");
  };

  return (
    <>
      {!embedded && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onClose} />}
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
            <div className="text-sm font-semibold">{form.id ? "编辑时间段" : "新建时间段"}</div>
            <div className="text-xs text-muted-foreground">
              {formatDateLabel(form.date)} · {slotToTimeString(form.start_slot)} –{" "}
              {slotToTimeString(form.end_slot)} · {duration}
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
              value={startInput}
              error={timeErrors.start}
              onChange={(value) => {
                setStartInput(value);
                setTimeError("start");
              }}
              onCommit={applyStartTime}
              onPreview={(value) => applyStartTime(value, false)}
              onStep={stepStartTime}
              inputRef={startInputRef}
              onEnter={(value) => handleSave("start", value)}
            />
            <TimeField
              label="结束时间"
              value={endInput}
              error={timeErrors.end}
              onChange={(value) => {
                setEndInput(value);
                setTimeError("end");
              }}
              onCommit={applyEndTime}
              onPreview={(value) => applyEndTime(value, false)}
              onStep={stepEndTime}
              inputRef={endInputRef}
              onEnter={(value) => handleSave("end", value)}
            />
          </div>
          {(timeErrors.start || timeErrors.end) && (
            <p className="-mt-2 text-xs text-destructive">{timeErrors.start || timeErrors.end}</p>
          )}

          {/* Work type */}
          <Field label="工作类型">
            <div className="flex flex-wrap gap-1.5">
              {effectiveTypes.map((wt) => (
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
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: wt.colorCss }} />
                  {wt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {resolveWorkType(form.work_type, settings)?.description ?? ""}
            </p>
          </Field>

          <Field label="标题">
            <input
              className="input"
              placeholder="一句话描述这段时间"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              onKeyDown={(e) => {
                if (isComposingEvent(e)) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </Field>

          {!lightweight && (
            <Field label="关联客户">
              <CustomerPicker
                value={form.customer}
                customerId={form.customer_id ?? null}
                onChange={(name, id) =>
                  setForm((f) => (f ? { ...f, customer: name, customer_id: id } : f))
                }
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
              className="input min-h-[140px] resize-y text-sm"
              placeholder={
                lightweight
                  ? "简短记录这段时间的要点…"
                  : "会议重点、客户反馈、内部同步结论或个人观察…"
              }
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              onKeyDown={(e) => {
                if (isComposingEvent(e)) return;
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Ctrl / ⌘ + Enter 保存</p>
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
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90"
          >
            {isSaving ? "保存中…" : "保存"}
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

function isComposingEvent(event: { nativeEvent: { isComposing?: boolean; keyCode?: number } }) {
  return event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
}

function completeTimeForSave(raw: string): string {
  const formatted = formatTimeEntry(raw);
  const match = formatted.match(/^(\d{1,2})(?::(\d{0,2}))?$/);
  if (!match) return formatted;
  const hours = match[1];
  const minutes = match[2] ?? "";
  return `${hours}:${minutes.padEnd(2, "0")}`;
}

function parseTimeSlot(raw: string): number | string {
  const input = raw.trim().toLowerCase();
  const match = input.match(/^(\d{1,4})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return "请输入如 13、930 或 13:45 的时间";

  const digits = match[1];
  let hours: number;
  let minutes: number;
  if (match[2] !== undefined) {
    hours = Number(digits);
    minutes = Number(match[2]);
  } else if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else {
    hours = Number(digits.slice(0, -2));
    minutes = Number(digits.slice(-2));
  }

  const meridiem = match[3];
  if (meridiem) {
    if (hours < 1 || hours > 12) return "am/pm 时间的小时需在 1–12 之间";
    if (meridiem === "am" && hours === 12) hours = 0;
    if (meridiem === "pm" && hours !== 12) hours += 12;
  }
  if (hours > 24 || minutes >= 60 || (hours === 24 && minutes !== 0)) {
    return "请输入有效时间";
  }
  if (minutes % SLOT_MINUTES !== 0) return `时间需按 ${SLOT_MINUTES} 分钟递增`;

  const totalMinutes = hours * 60 + minutes;
  const slot = (totalMinutes - 7 * 60) / SLOT_MINUTES;
  if (!Number.isInteger(slot) || slot < 0 || slot > TOTAL_SLOTS) {
    return "可输入范围为 07:00–24:00";
  }
  return slot;
}

function formatMinute(digits: string): string {
  if (!digits || Number(digits[0]) > 5) return "";
  return digits.slice(0, 2);
}

/** Formats a digit stream without assuming the first two digits form an hour. */
function formatDigitTime(digits: string): string {
  if (!digits) return "";
  const first = digits[0];
  if (Number(first) >= 3) return `${first}:${formatMinute(digits.slice(1))}`;
  if (digits.length === 1) return first;

  const twoDigitHour = Number(digits.slice(0, 2));
  if (twoDigitHour <= 23) return `${digits.slice(0, 2)}:${formatMinute(digits.slice(2))}`;
  return `${first}:${formatMinute(digits.slice(1))}`;
}

function formatTimeEntry(raw: string): string {
  const clean = raw.replace(/[^\d:]/g, "");
  const colonIndex = clean.indexOf(":");
  if (colonIndex < 0) return formatDigitTime(clean);

  const hours = clean.slice(0, colonIndex).replace(/\D/g, "").slice(0, 2);
  const minutes = clean.slice(colonIndex + 1).replace(/\D/g, "");
  if (!hours) return formatDigitTime(minutes);
  if (hours.length === 2 && Number(hours) > 23) return formatDigitTime(hours + minutes);
  return `${hours}:${formatMinute(minutes)}`;
}

function removeTimeCharacter(value: string, start: number, end: number): string {
  if (start !== end) return formatTimeEntry(value.slice(0, start) + value.slice(end));
  if (start === 0) return value;
  // Backspacing immediately after the colon removes the colon and its preceding hour digit together.
  if (value[start - 1] === ":") {
    return formatTimeEntry(value.slice(0, Math.max(0, start - 2)) + value.slice(start));
  }
  return formatTimeEntry(value.slice(0, start - 1) + value.slice(start));
}

function isCompleteTimeEntry(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
}

function TimeField({
  label,
  value,
  error,
  onChange,
  onCommit,
  onPreview,
  onStep,
  inputRef,
  onEnter,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onPreview: (v: string) => void;
  onStep: (direction: 1 | -1, amount: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEnter: (value: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const setValue = (input: HTMLInputElement, next: string) => {
    onChange(next);
    if (isCompleteTimeEntry(next)) onPreview(next);
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(next.length, next.length);
    });
  };

  const insertDigit = (input: HTMLInputElement, digit: string) => {
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const next = formatTimeEntry(value.slice(0, start) + digit + value.slice(end));
    setValue(input, next);
  };

  return (
    <div>
      <div className="text-xs font-medium text-foreground/80 mb-1.5">{label}</div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className={cn("input pr-9", error && "border-destructive")}
          value={value}
          onChange={(e) => {
            // Fallback for mobile keyboards, which may not emit a usable keydown event.
            const next = formatTimeEntry(e.target.value);
            onChange(next);
            if (isCompleteTimeEntry(next)) onPreview(next);
          }}
          onBlur={(e) => onCommit(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (isComposingEvent(e)) return;
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter(e.currentTarget.value);
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onStep(e.key === "ArrowUp" ? 1 : -1, e.shiftKey ? SLOTS_PER_HOUR : 1);
            } else if (e.key === "Backspace") {
              e.preventDefault();
              const start = e.currentTarget.selectionStart ?? value.length;
              const end = e.currentTarget.selectionEnd ?? start;
              setValue(e.currentTarget, removeTimeCharacter(value, start, end));
            } else if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              insertDigit(e.currentTarget, e.key);
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const next = formatTimeEntry(e.clipboardData.getData("text"));
            setValue(e.currentTarget, next);
          }}
          aria-invalid={!!error}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary text-muted-foreground"
          onClick={() => {
            if (typeof pickerRef.current?.showPicker === "function") pickerRef.current.showPicker();
            else pickerRef.current?.click();
          }}
          aria-label={`使用时钟选择${label}`}
        >
          <Clock3 className="w-3.5 h-3.5" />
        </button>
        <input
          ref={pickerRef}
          type="time"
          step={SLOT_MINUTES * 60}
          className="sr-only"
          value={value.match(/^\d{2}:\d{2}$/) ? value : ""}
          onChange={(e) => onCommit(e.target.value)}
          tabIndex={-1}
          aria-hidden
        />
      </div>
    </div>
  );
}

/**
 * 关联客户选择器：可搜索选择客户看板里的已有客户（写入 customer_id），
 * 也可以直接输入自由文本（customer_id 保持 null）。
 */
function CustomerPicker({
  value,
  customerId,
  onChange,
}: {
  value: string;
  customerId: string | null;
  onChange: (name: string, id: string | null) => void;
}) {
  const { customers, loading } = useCustomers();
  const [open, setOpen] = useState(false);

  const q = value.trim().toLowerCase();
  const matches = q ? customers.filter((c) => c.companyName.toLowerCase().includes(q)) : customers;
  const visible = matches.slice(0, 20);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          className="input"
          placeholder="搜索已有客户，或直接输入名称"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange(e.target.value, null)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 p-2 rounded-md border border-border hover:bg-secondary"
          aria-label="展开客户列表"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {customerId ? (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Check className="w-3 h-3" />
          已关联客户看板中的客户
          <button
            type="button"
            onClick={() => onChange(value, null)}
            className="ml-1 underline hover:text-foreground"
          >
            取消关联
          </button>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          未关联客户，仅作为自由文本保存
        </div>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius)] border border-border bg-card shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">正在加载客户…</div>}
          {!loading && visible.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              没有匹配的客户，可直接输入自由文本。
            </div>
          )}
          {!loading &&
            visible.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.companyName, c.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-secondary",
                  c.id === customerId && "bg-secondary",
                )}
              >
                <div className="font-medium truncate">{c.companyName}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {STAGE_LABEL[c.stage]}
                  {c.contactName ? ` · ${c.contactName}` : ""}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
