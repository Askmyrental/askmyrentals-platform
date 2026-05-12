import type { ActivityRecord } from "../types";

export function todayDateTime() {
  return new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function makeRecord(
  event: string,
  source: ActivityRecord["source"] = "System"
): ActivityRecord {
  const now = new Date();

  return {
    id: now.getTime() + Math.floor(Math.random() * 1000),
    time: todayDateTime(),
    event,
    source,
    createdAt: now.toISOString(),
  };
}

export function normalizeRecords(records: ActivityRecord[] | undefined) {
  if (!Array.isArray(records)) return [];

  return records.map((record, index) => ({
    ...record,
    id: record.id || Date.now() + index,
    time: record.time || "Unknown time",
    event: record.event || "Record saved.",
    source: record.source || "System",
  }));
}