import { Download, SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface TableFieldOption {
  key: string;
  label: string;
}

export interface TablePresetOption {
  value: string;
  label: string;
}

export function TableFieldControls({
  preset,
  presets,
  customPreset,
  fields,
  customFields,
  onPresetChange,
  onToggleField,
  onExport,
}: {
  preset: string;
  presets: TablePresetOption[];
  customPreset: string;
  fields: TableFieldOption[];
  customFields: string[];
  onPresetChange: (preset: string) => void;
  onToggleField: (field: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(event) => onPresetChange(event.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60"
        aria-label="列预设"
      >
        {presets.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {preset === customPreset && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              选择字段
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <div className="text-xs font-medium">自定义字段</div>
            <p className="mt-1 text-[11px] text-muted-foreground">公司名固定为第一列。</p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {fields.map((field) => (
                <label key={field.key} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={customFields.includes(field.key)}
                    onCheckedChange={() => onToggleField(field.key)}
                  />
                  <span className="truncate">{field.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <button
        type="button"
        onClick={onExport}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
        导出 CSV
      </button>
    </div>
  );
}
