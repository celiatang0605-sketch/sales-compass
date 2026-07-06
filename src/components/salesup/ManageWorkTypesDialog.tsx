import { useEffect, useState } from "react";
import { X, Plus, Trash2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import {
  BUILTIN_CATEGORY_LABELS,
  PRESET_SWATCHES,
  categoryLabel,
  useWorkTypeSettings,
  type CustomWorkType,
} from "@/lib/salesup/workTypeSettings";
import { WORK_TYPES, type BuiltinWorkTypeId, type StatCategory } from "@/lib/salesup/workTypes";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

export function ManageWorkTypesDialog({ onClose }: Props) {
  const {
    settings,
    hideBuiltin,
    unhideBuiltin,
    addCustomType,
    updateCustomType,
    removeCustomType,
    addCustomCategory,
    removeCustomCategory,
  } = useWorkTypeSettings();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [draft, setDraft] = useState({
    label: "",
    color: PRESET_SWATCHES[0],
    category: "customer_progress" as string,
  });
  const [newCatLabel, setNewCatLabel] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const commitAdd = () => {
    const label = draft.label.trim();
    if (!label) return;
    addCustomType({ label, color: draft.color, category: draft.category });
    setDraft({ label: "", color: PRESET_SWATCHES[0], category: draft.category });
  };

  const commitNewCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const c = addCustomCategory(label);
    setDraft((d) => ({ ...d, category: c.id }));
    setNewCatLabel("");
    setShowNewCat(false);
  };

  const allCategories = [
    ...(Object.keys(BUILTIN_CATEGORY_LABELS) as StatCategory[]).map((id) => ({
      id: id as string,
      label: BUILTIN_CATEGORY_LABELS[id],
      isCustom: false,
    })),
    ...settings.customCategories.map((c) => ({ id: c.id, label: c.label, isCustom: true })),
  ];

  const body = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">管理工作类型</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              新增自定义类型、隐藏用不到的内置类型。设置保存在本机浏览器。
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* --- Add new type --- */}
          <section className="rounded-xl border border-dashed border-border bg-background/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-xs font-semibold">新增工作类型</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <label className="block">
                  <div className="text-[11px] text-muted-foreground mb-1">名称</div>
                  <input
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="例如：招投标准备"
                    className="w-full px-3 py-1.5 rounded-md border border-border bg-card text-sm outline-none focus:border-ring"
                  />
                </label>
                <label className="block">
                  <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-2">
                    <span>统计分类</span>
                    <button
                      type="button"
                      onClick={() => setShowNewCat((v) => !v)}
                      className="text-primary hover:underline text-[11px]"
                    >
                      {showNewCat ? "取消" : "+ 新建分类"}
                    </button>
                  </div>
                  {showNewCat ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newCatLabel}
                        onChange={(e) => setNewCatLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitNewCategory();
                          }
                        }}
                        placeholder="新分类名称，例如：招投标"
                        className="flex-1 px-3 py-1.5 rounded-md border border-border bg-card text-sm outline-none focus:border-ring"
                      />
                      <button
                        type="button"
                        onClick={commitNewCategory}
                        className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90"
                      >
                        添加
                      </button>
                    </div>
                  ) : (
                    <select
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-border bg-card text-sm outline-none focus:border-ring"
                    >
                      {allCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                          {c.isCustom ? "（自定义）" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">颜色</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {PRESET_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setDraft({ ...draft, color: hex })}
                      className={cn(
                        "w-7 h-7 rounded-md ring-1 transition",
                        draft.color === hex
                          ? "ring-foreground/60 scale-105"
                          : "ring-foreground/10 hover:ring-foreground/30",
                      )}
                      style={{ background: hex }}
                      aria-label={hex}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">自定义</span>
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="h-7 w-10 rounded border border-border bg-card cursor-pointer"
                  />
                  <span className="font-mono text-foreground">{draft.color.toLowerCase()}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={commitAdd}
                disabled={!draft.label.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                添加类型
              </button>
            </div>
          </section>

          {/* --- Custom types list --- */}
          {settings.customTypes.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold mb-2 text-foreground/80">自定义类型</h3>
              <div className="space-y-1.5">
                {settings.customTypes.map((t) => (
                  <CustomTypeRow
                    key={t.id}
                    type={t}
                    categoryOptions={allCategories}
                    onUpdate={(patch) => updateCustomType(t.id, patch)}
                    onRemove={() => {
                      if (confirm(`删除自定义类型「${t.label}」?已有此类型的时间块会被标为「其它」显示。`)) {
                        removeCustomType(t.id);
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* --- Built-in types --- */}
          <section>
            <h3 className="text-xs font-semibold mb-2 text-foreground/80">内置类型</h3>
            <p className="text-[11px] text-muted-foreground mb-2">
              内置类型无法删除,但可以隐藏。已隐藏的类型不会出现在图例和录入选项中,但已有的时间块不受影响。
            </p>
            <div className="space-y-1">
              {WORK_TYPES.map((wt) => {
                const hidden = settings.hiddenBuiltins.includes(wt.id);
                const overrideLabel = settings.labels[wt.id];
                return (
                  <div
                    key={wt.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-card",
                      hidden && "opacity-50",
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: settings.colors[wt.id] ?? `var(${wt.colorVar})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {overrideLabel || wt.label}
                        {overrideLabel && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            (原:{wt.label})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {wt.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => (hidden ? unhideBuiltin(wt.id) : hideBuiltin(wt.id))}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border hover:bg-secondary text-muted-foreground"
                      title={hidden ? "重新启用" : "隐藏"}
                    >
                      {hidden ? (
                        <>
                          <Eye className="w-3 h-3" />
                          启用
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          隐藏
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* --- Custom categories --- */}
          {settings.customCategories.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold mb-2 text-foreground/80">自定义统计分类</h3>
              <div className="space-y-1">
                {settings.customCategories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-card"
                  >
                    <div className="flex-1 text-sm">{c.label}</div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `删除自定义分类「${c.label}」?归属此分类的自定义类型会被移到「其它」。`,
                          )
                        ) {
                          removeCustomCategory(c.id);
                        }
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="删除分类"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90"
          >
            完成
          </button>
        </footer>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

function CustomTypeRow({
  type,
  categoryOptions,
  onUpdate,
  onRemove,
}: {
  type: CustomWorkType;
  categoryOptions: { id: string; label: string; isCustom: boolean }[];
  onUpdate: (patch: Partial<CustomWorkType>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-md border border-border bg-card">
      <input
        type="color"
        value={type.color}
        onChange={(e) => onUpdate({ color: e.target.value })}
        className="h-6 w-8 rounded border border-border cursor-pointer shrink-0"
        aria-label="颜色"
      />
      <input
        value={type.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        className="flex-1 min-w-[8rem] px-2 py-1 rounded-md border border-border bg-background text-sm outline-none focus:border-ring"
      />
      <select
        value={type.category}
        onChange={(e) => onUpdate({ category: e.target.value })}
        className="px-2 py-1 rounded-md border border-border bg-background text-xs outline-none focus:border-ring"
      >
        {categoryOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
            {c.isCustom ? "（自定义）" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        aria-label="删除"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
