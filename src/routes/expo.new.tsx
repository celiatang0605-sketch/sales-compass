import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Save, Check } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import { RATING_LABEL, todayIso, type ExpoRating } from "@/lib/salesup/expoMock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expo/new")({
  head: () => ({ meta: [{ title: "快速记录 · 展会线索" }] }),
  component: ExpoNewPage,
});

const RATINGS: ExpoRating[] = ["A", "B", "C", "D", "unrated"];

function ExpoNewPage() {
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [raw, setRaw] = useState("");
  const [rating, setRating] = useState<ExpoRating>("unrated");
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate] = useState(todayIso());
  const [savedFlash, setSavedFlash] = useState<null | "back" | "again">(null);

  const canSave = company.trim().length > 0;

  const handleSave = (mode: "back" | "again") => {
    if (!canSave) return;
    // Phase 1: mock save only.
    setSavedFlash(mode);
    setTimeout(() => {
      if (mode === "back") {
        navigate({ to: "/expo" });
      } else {
        setCompany("");
        setRaw("");
        setRating("unrated");
        setNextAction("");
        setNextDate(todayIso());
        setSavedFlash(null);
      }
    }, 600);
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto pb-28 md:pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link
            to="/expo"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>

        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">快速记录</h1>
          <p className="text-sm text-muted-foreground mt-1">
            现场先把关键信息落下来，回去再补齐。
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <Field label="公司 / 线索名称" required>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="例如：星海传媒集团"
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              autoFocus
            />
          </Field>

          <Field label="原始记录" hint="现场简讯 / 关键词，先写下来即可">
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="对方来展位、聊了什么、预算/时间线、痛点……"
              rows={7}
              className="w-full min-h-[140px] px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 leading-relaxed"
            />
          </Field>

          <Field label="评级">
            <div className="flex gap-1.5 flex-wrap">
              {RATINGS.map((r) => {
                const active = r === rating;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={cn(
                      "px-3 h-9 rounded-full border text-xs transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    {RATING_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <Field label="下一步动作">
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="例如：发送方案、加微信、约拜访"
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
            </Field>
            <Field label="下一步日期">
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full md:w-44 h-11 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
            </Field>
          </div>
        </div>

        {/* Inline hint on desktop */}
        <div className="hidden md:flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => handleSave("again")}
            disabled={!canSave}
            className="h-10 px-4 rounded-lg border border-border text-sm hover:bg-secondary disabled:opacity-50"
          >
            保存并继续记录下一家
          </button>
          <button
            onClick={() => handleSave("back")}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {savedFlash === "back" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            保存
          </button>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur px-4 py-3 flex gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={() => handleSave("again")}
          disabled={!canSave}
          className="flex-1 h-11 rounded-lg border border-border text-sm bg-background disabled:opacity-50"
        >
          {savedFlash === "again" ? "已保存 ✓" : "保存并继续"}
        </button>
        <button
          onClick={() => handleSave("back")}
          disabled={!canSave}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {savedFlash === "back" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          保存
        </button>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground/80">
          {label}
          {required && <span className="text-rose-600 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
