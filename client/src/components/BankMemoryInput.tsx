import React, { useId, useMemo, type ComponentProps, type FocusEventHandler } from "react";
import { trpc } from "@/lib/trpc";

type BankMemoryInputProps = ComponentProps<"input"> & {
  moduleKey: string;
  fieldKey: string;
  localOptions?: string[];
  labelAr?: string;
  labelEn?: string;
};

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter(value => {
    const clean = value.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

export function BankMemoryInput({ moduleKey, fieldKey, localOptions = [], labelAr, labelEn, onBlur, value, ...props }: BankMemoryInputProps) {
  const listId = `bank-memory-${useId().replace(/:/g, "")}`;
  const suggestions = trpc.memory.list.useQuery(
    { moduleKey, fieldKey, limit: 120 },
    { enabled: Boolean(moduleKey && fieldKey), retry: false, refetchOnWindowFocus: false },
  );
  const remember = trpc.memory.remember.useMutation();
  const remoteValues = (suggestions.data?.data || []).map(item => item.value_text);
  const values = useMemo(() => uniqueValues([...localOptions, ...remoteValues]), [localOptions, remoteValues.join("\u0000")]);
  const currentValue = typeof value === "string" ? value : "";

  const handleBlur: FocusEventHandler<HTMLInputElement> = event => {
    if (currentValue.trim()) {
      void remember.mutateAsync({ moduleKey, fieldKey, value: currentValue, labelAr, labelEn }).catch(() => undefined);
    }
    onBlur?.(event);
  };

  return (
    <>
      <input {...props} {...(value === undefined ? {} : { value })} list={listId} onBlur={handleBlur} />
      <datalist id={listId}>
        {values.map(item => <option key={item} value={item} />)}
      </datalist>
    </>
  );
}
