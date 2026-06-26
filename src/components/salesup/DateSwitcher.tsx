import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addDays, formatDateLabel, todayKey } from "@/lib/salesup/date";

interface Props {
  date: string;
  onChange: (date: string) => void;
}

export function DateSwitcher({ date, onChange }: Props) {
  const isToday = date === todayKey();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => onChange(addDays(date, -1))}
          className="px-2.5 py-1.5 hover:bg-secondary"
          aria-label="前一天"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="px-3 py-1.5 text-sm font-medium border-l border-r border-border min-w-[170px] text-center">
          {formatDateLabel(date)}
        </div>
        <button
          onClick={() => onChange(addDays(date, 1))}
          className="px-2.5 py-1.5 hover:bg-secondary"
          aria-label="后一天"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={() => onChange(todayKey())}
        className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary disabled:opacity-50"
        disabled={isToday}
      >
        回到今天
      </button>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs hover:bg-secondary cursor-pointer">
        <CalendarDays className="w-3.5 h-3.5" />
        <span>选择日期</span>
        <input
          type="date"
          className="sr-only"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
