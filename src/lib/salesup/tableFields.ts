import { useEffect, useMemo, useState } from "react";

export interface TableFieldPreferenceOptions<Field extends string, Preset extends string> {
  fixedField: Field;
  allCustomFields: readonly Field[];
  presets: Partial<Record<Preset, readonly Field[]>>;
  presetValues: readonly Preset[];
  defaultPreset: Preset;
  customPreset: Preset;
  presetStorageKey: string;
  customFieldsStorageKey: string;
}

/** Shared persisted column preferences for list-style tables. */
export function useTableFieldPreferences<Field extends string, Preset extends string>(
  options: TableFieldPreferenceOptions<Field, Preset>,
) {
  const {
    fixedField,
    allCustomFields,
    presets,
    presetValues,
    defaultPreset,
    customPreset,
    presetStorageKey,
    customFieldsStorageKey,
  } = options;
  const defaultCustomFields = (presets[defaultPreset] ?? []).filter(
    (field) => field !== fixedField,
  ) as Field[];
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [customFields, setCustomFields] = useState<Field[]>(defaultCustomFields);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedPreset = window.localStorage.getItem(presetStorageKey);
      if (savedPreset && presetValues.includes(savedPreset as Preset)) {
        setPreset(savedPreset as Preset);
      }

      const savedFields = JSON.parse(window.localStorage.getItem(customFieldsStorageKey) ?? "null");
      if (!Array.isArray(savedFields)) return;
      const validFields = savedFields.filter(
        (field): field is Field =>
          typeof field === "string" && allCustomFields.includes(field as Field),
      );
      setCustomFields(Array.from(new Set(validFields)));
    } catch {
      // Ignore malformed local preferences and use the default fields.
    }
  }, [allCustomFields, customFieldsStorageKey, presetStorageKey, presetValues]);

  const visibleFields = useMemo(() => {
    if (preset === customPreset) return [fixedField, ...customFields] as Field[];
    return (presets[preset] ?? [fixedField]) as Field[];
  }, [customFields, customPreset, fixedField, preset, presets]);

  const changePreset = (nextPreset: Preset) => {
    setPreset(nextPreset);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(presetStorageKey, nextPreset);
    }
  };

  const toggleCustomField = (field: Field) => {
    const nextFields = customFields.includes(field)
      ? customFields.filter((item) => item !== field)
      : [...customFields, field];
    setCustomFields(nextFields);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(customFieldsStorageKey, JSON.stringify(nextFields));
    }
  };

  return {
    preset,
    customFields,
    visibleFields,
    changePreset,
    toggleCustomField,
  };
}
