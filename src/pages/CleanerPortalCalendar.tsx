import { useState } from "react";

type CleanerPortalCalendarProps = {
  cleanerTasks: any[];
  homes: any[];
  getUrgency: (date: string) => any;
  onSelectTask?: (taskId: string) => void;
};

export default function CleanerPortalCalendar({
  cleanerTasks,
  homes,
  getUrgency,
  onSelectTask,
}: CleanerPortalCalendarProps) {
  const today = new Date();

  const [calendarMonth, setCalendarMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const monthStart = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  );

  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const tasksForDay = (date: Date) => {
    const key = toDateKey(date);

    return cleanerTasks.filter(
      (task) => task.departure === key
    );
  };

  const isBackToBack = (task: any) =>
    cleanerTasks.some(
      (item) =>
        item.id !== task.id &&
        item.homeId === task.homeId &&
        item.arrival === task.departure
    );

  const goToPreviousMonth = () => {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      )
    );
  };

  const goToNextMonth = () => {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      )
    );
  };

  return (
    <section
      className="cleanerCalendarPanel"
      id="cleanerPortalCalendar"
    >
      <div className="cleanerMonthHeader">
        <button
          type="button"
          className="calendarMonthNav"
          onClick={goToPreviousMonth}
          aria-label="Previous month"
        >
          ←
        </button>

        <strong>
          {calendarMonth.toLocaleString("default", {
            month: "long",
          })}{" "}
          {calendarMonth.getFullYear()}
        </strong>

        <button
          type="button"
          className="calendarMonthNav"
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="cleanerCalendarGrid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
          (day) => (
            <div
              key={day}
              className="cleanerCalendarDayName"
            >
              {day}
            </div>
          )
        )}

        {days.map((day) => {
          const dateKey = toDateKey(day);
          const dayTasks = tasksForDay(day);
          const isCurrentMonth =
            day.getMonth() === calendarMonth.getMonth();

          return (
            <div
              key={dateKey}
              className={`cleanerCalendarDay ${
                isCurrentMonth ? "" : "mutedCalendarDay"
              }`}
            >
              <span className="cleanerCalendarDateNumber">
                {day.getDate()}
              </span>

              {dayTasks.slice(0, 2).map((task) => {
                const home = homes.find(
                  (item) => item.id === task.homeId
                );
                const urgency = getUrgency(task.departure);

                return (
                  <button
                    key={`${task.id}-${dateKey}`}
                    type="button"
                    className={`cleanerCalendarEvent ${urgency.className}`}
                    onClick={() =>
                      onSelectTask?.(String(task.id))
                    }
                    aria-label={`Open task for ${
                      home?.name ?? "Cleaning"
                    } on ${dateKey}`}
                  >
                    <span>
                      {home?.name ?? "Cleaning"}
                    </span>

                    {isBackToBack(task) && (
                      <span className="calendarB2BBadge">
                        🔁 B2B
                      </span>
                    )}
                  </button>
                );
              })}

              {dayTasks.length > 2 && (
                <small className="mutedText">
                  +{dayTasks.length - 2} more
                </small>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}