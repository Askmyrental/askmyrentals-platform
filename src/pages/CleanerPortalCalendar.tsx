import { useState } from "react";

type CleanerPortalCalendarProps = {
  cleanerTasks: any[];
  homes: any[];
  getUrgency: (date: string) => any;
};

export default function CleanerPortalCalendar({
  cleanerTasks,
  homes,
  getUrgency,
}: CleanerPortalCalendarProps) {
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });

  const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

  const tasksForDay = (date: Date) => {
    const key = toDateKey(date);
    return cleanerTasks.filter((task) => task.arrival <= key && task.departure >= key);
  };

  const goToPreviousMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
    );
  };

  return (
    <section className="cleanerCalendarPanel" id="cleanerPortalCalendar">
      <div className="panelHeader compact">
        <div>
          <p className="eyebrow">Cleaner schedule</p>
          <h3>My Calendar</h3>
        </div>

        <span className="occupancyAlertPill">{cleanerTasks.length} assigned</span>
      </div>

      <div className="cleanerMonthHeader">
        <button type="button" className="calendarMonthNav" onClick={goToPreviousMonth}>
          ←
        </button>

        <strong>
          {calendarMonth.toLocaleString("default", { month: "long" })}{" "}
          {calendarMonth.getFullYear()}
        </strong>

        <button type="button" className="calendarMonthNav" onClick={goToNextMonth}>
          →
        </button>
      </div>

      <div className="cleanerCalendarGrid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="cleanerCalendarDayName">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dateKey = toDateKey(day);
          const dayTasks = tasksForDay(day);
          const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();

          return (
            <div
              key={dateKey}
              className={`cleanerCalendarDay ${isCurrentMonth ? "" : "mutedCalendarDay"}`}
            >
              <span className="cleanerCalendarDateNumber">{day.getDate()}</span>

              {dayTasks.slice(0, 2).map((task) => {
                const home = homes.find((item) => item.id === task.homeId);
                const urgency = getUrgency(task.arrival);

                return (
                  <div key={task.id} className={`cleanerCalendarEvent ${urgency.className}`}>
                    {home?.name ?? "Cleaning"}
                  </div>
                );
              })}

              {dayTasks.length > 2 && (
                <small className="mutedText">+{dayTasks.length - 2} more</small>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}