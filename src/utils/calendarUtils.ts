export function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: Array<{
    date: Date;
    inMonth: boolean;
    isBlank?: boolean;
  }> = [];

  // Blank cells before the first day of the month
  for (let i = 0; i < startDay; i += 1) {
    days.push({
      date: firstDay,
      inMonth: false,
      isBlank: true,
    });
  }

  // Actual days of the month
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      date: new Date(year, month, day),
      inMonth: true,
    });
  }

  return days;
}
export function getStackedCalendarMonths(anchorDate: Date, count = 12) {
  const anchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);

  return Array.from(
    { length: count },
    (_item, index) =>
      new Date(anchor.getFullYear(), anchor.getMonth() + index, 1)
  );
}