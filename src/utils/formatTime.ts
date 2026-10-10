// "10:00" or "10:00:00" -> "10:00 AM"
export function formatClockTime(value: string | null | undefined) {
  if (!value) return "";
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteText.padStart(2, "0")} ${period}`;
}
