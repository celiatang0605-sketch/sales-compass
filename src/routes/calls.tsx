import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/salesup/AppShell";
import { addDays, todayKey, weekRangeOf } from "@/lib/salesup/date";
import { useCallSettings } from "@/lib/salesup/callSettings";
import { useCallTracker } from "@/lib/salesup/useCallTracker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calls")({
  head: () => ({
    meta: [
      { title: "拨打打卡 · Sales Up" },
      { name: "description", content: "记录每一通实际拨出的电话。" },
    ],
  }),
  component: CallsPage,
});

function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const HEAT_CLASS: Record<ReturnType<typeof heatLevel>, string> = {
  0: "bg-muted",
  1: "bg-chart-1/40",
  2: "bg-chart-1/75",
  3: "bg-primary",
};

function CallsPage() {
  const { dailyGoal, milestones } = useCallSettings();
  const { stats, loading, error, userId, logCall, undoCall } = useCallTracker();
  const [recording, setRecording] = useState(false);
  const undoToastId = useRef<string | number | undefined>(undefined);
  const today = todayKey();
  const todayCount = stats?.todayCount ?? 0;
  const totalCount = stats?.totalCount ?? 0;
  const streakDays = stats?.streakDays ?? 0;

  const weeks = useMemo(() => {
    const currentWeekStart = weekRangeOf(today).start;
    return Array.from({ length: 12 }, (_, index) => {
      const start = addDays(currentWeekStart, -7 * (11 - index));
      return weekRangeOf(start).days;
    });
  }, [today]);

  const dismissUndoToast = () => {
    if (undoToastId.current !== undefined) {
      toast.dismiss(undoToastId.current);
      undoToastId.current = undefined;
    }
  };

  const showUndoToast = (id: string) => {
    dismissUndoToast();
    undoToastId.current = toast.success("已记一通", {
      duration: 5000,
      action: {
        label: "撤销",
        onClick: () => {
          dismissUndoToast();
          void undoCall(id).catch((cause) => {
            toast.error(cause instanceof Error ? cause.message : "撤销失败，请稍后重试");
          });
        },
      },
    });
  };

  const record = async () => {
    if (!userId || recording) return;
    setRecording(true);
    try {
      const attempt = await logCall();
      showUndoToast(attempt.id);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "记录失败，请稍后重试");
    } finally {
      setRecording(false);
    }
  };

  const nextMilestone = milestones.find((milestone) => totalCount < milestone);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-[-0.01em]">拨打打卡</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            只记拨出去了。接没接通、谈成没谈成，都不影响这里的数字。
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-[14px] border border-border bg-card px-6 py-[22px]">
            <div className="mb-3.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">
              今日
            </div>
            <div className="flex items-center gap-5">
              <div>
                <div className="text-[52px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                  {todayCount}
                  <span className="ml-1 text-[19px] font-semibold text-muted-foreground">
                    / {dailyGoal}
                  </span>
                </div>
                <div className="mt-3.5 flex gap-[7px]" aria-label={`今日已完成 ${todayCount} 通`}>
                  {Array.from({ length: dailyGoal }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-[11px] w-[11px] rounded-full",
                        index < todayCount ? "bg-primary" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="ml-auto text-right">
                <button
                  type="button"
                  onClick={() => void record()}
                  disabled={!userId || recording}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-[22px] py-[13px] text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recording ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneCall className="h-4 w-4" />
                  )}
                  ＋ 记一通
                </button>
                <div className="mt-2 text-[11.5px] text-muted-foreground">不必选线索</div>
              </div>
            </div>
          </section>

          <section className="rounded-[14px] border border-border bg-card px-6 py-[22px]">
            <div className="mb-3.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">
              连续
            </div>
            <div className="text-[40px] font-bold leading-none tracking-[-0.02em] tabular-nums">
              {streakDays}
              <span className="ml-1 text-[15px] font-semibold text-muted-foreground">天</span>
            </div>
            {streakDays > 0 && (
              <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-md bg-chart-2/20 px-2.5 py-[5px] text-[11.5px] font-semibold text-chart-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                本周补签 1 次可用
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-[14px] border border-border bg-card px-6 py-[22px]">
            <div className="mb-3.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">
              最近 12 周
            </div>
            <div className="flex gap-1" aria-label="最近 12 周拨打热力图">
              {weeks.map((week, index) => (
                <div key={index} className="flex flex-col gap-1">
                  {week.map((day) => {
                    const count = stats?.dailyCounts[day] ?? 0;
                    return (
                      <span
                        key={day}
                        title={`${day}：${count} 通`}
                        className={cn(
                          "h-[13px] w-[13px] rounded-[3px]",
                          HEAT_CLASS[heatLevel(count)],
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
              <span>少</span>
              {[0, 1, 2, 3].map((level) => (
                <span
                  key={level}
                  className={cn(
                    "h-[11px] w-[11px] rounded-[3px]",
                    HEAT_CLASS[level as 0 | 1 | 2 | 3],
                  )}
                />
              ))}
              <span>多</span>
            </div>
          </section>

          <section className="rounded-[14px] border border-border bg-card px-6 py-[22px]">
            <div className="mb-3.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">
              累计 {totalCount} 通
            </div>
            <div className="flex gap-2.5">
              {milestones.map((milestone) => {
                const achieved = totalCount >= milestone;
                const next = milestone === nextMilestone;
                const remaining = Math.max(0, milestone - totalCount);
                return (
                  <div
                    key={milestone}
                    className={cn(
                      "min-w-0 flex-1 rounded-[11px] border border-border bg-secondary/40 px-2.5 py-[15px] text-center",
                      achieved && "border-primary bg-primary text-primary-foreground",
                      next && "border-chart-2 bg-chart-2/20 text-chart-2",
                    )}
                  >
                    <div className="text-xl font-bold leading-none tabular-nums">{milestone}</div>
                    <div className="mt-1.5 text-[11px] opacity-75">
                      {achieved ? "已达成" : next ? `还差 ${remaining} 通` : "未解锁"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[14px] border border-border bg-card px-6 py-[22px]">
          <div className="mb-3.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">
            今日记录
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在读取记录…
            </div>
          ) : (stats?.todayCalls.length ?? 0) === 0 ? (
            <div className="py-5 text-sm text-muted-foreground">
              今天还没有记录，先记下第一通吧。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                    <th className="w-[74px] pb-[11px] font-semibold">时间</th>
                    <th className="pb-[11px] font-semibold">线索</th>
                    <th className="pb-[11px] font-semibold">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.todayCalls.map((call) => (
                    <tr key={call.id} className="border-b border-border/60 last:border-b-0">
                      <td className="py-[13px] tabular-nums text-muted-foreground">
                        {new Intl.DateTimeFormat("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(new Date(call.calledAt))}
                      </td>
                      <td
                        className={cn(
                          "py-[13px]",
                          !call.companyName && "italic text-muted-foreground",
                        )}
                      >
                        {call.companyName || "未关联线索"}
                      </td>
                      <td className={cn("py-[13px]", !call.note && "italic text-muted-foreground")}>
                        {call.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
