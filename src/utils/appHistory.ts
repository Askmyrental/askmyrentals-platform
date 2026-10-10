import { useSearchParams } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";

export function updateAppSearch(search: string, key: string, value: string | null) {
  const params = new URLSearchParams(search);
  if (value === null) params.delete(key);
  else params.set(key, value);
  if (key === "view") {
    ["task", "calendar", "day", "month"].forEach((name) => params.delete(name));
  }
  if (key === "calendar" && value === null) {
    ["task", "day"].forEach((name) => params.delete(name));
  }
  return params;
}

export function useAppHistoryValue(key: string, fallback: string | null = null, workspace?: string) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const setValue: Dispatch<SetStateAction<string | null>> = (next) => {
    const resolved = typeof next === "function" ? next(value) : next;
    if (resolved === value) return;
    setParams((current) => {
      const updated = updateAppSearch(current.toString(), key, resolved);
      if (workspace) updated.set("workspace", workspace);
      return updated;
    });
  };
  return [value, setValue] as const;
}
