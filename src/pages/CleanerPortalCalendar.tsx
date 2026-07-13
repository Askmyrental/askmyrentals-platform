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

  const normalizeDateKey = (value: unknown) =>
    String(value ?? "").slice(0, 10);

  const normalizeId = (value: unknown) => String(value ?? "");

  const getTaskDate = (task: any) =>
    task.departure ??
    task.scheduledDate ??
    task.scheduled_date ??
    "";

  const getTaskTime = (task: any) =>
    task.scheduledTime ??
    task.scheduled_time ??
    "";

  const tasksForDay = (date: Date) => {
    const key = toDateKey(date);

    return cleanerTasks
      .filter((task) => normalizeDateKey(getTaskDate(task)) === key)
      .sort((first, second) =>
        String(getTaskTime(first)).localeCompare(String(getTaskTime(second)))
      );
  };

  const isBackToBack = (task: any) => {
    if (task.isCleanerJob) return false;

    return cleanerTasks.some(
      (item) =>
        !item.isCleanerJob &&
        normalizeId(item.id) !== normalizeId(task.id) &&
        normalizeId(item.homeId) === normalizeId(task.homeId) &&
        normalizeDateKey(item.arrival) ===
          normalizeDateKey(task.departure)
    );
  };

  const getTaskTitle = (task: any) => {
    if (task.isCleanerJob) {
      return task.jobType ?? task.taskType ?? "Independent Job";
    }

    const home = homes.find(
      (item) => normalizeId(item.id) === normalizeId(task.homeId)
    );

    return home?.name ?? "Cleaning";
  };

  return (
    <section className="cleanerCalendarPanel" id="cleanerPortalCalendar">
      <div className="cleanerMonthHeader">
        <button
          type="button"
          className="calendarMonthNav"
          onClick={() =>
            setCalendarMonth(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() - 1,
                1
              )
            )
          }
          aria-label="Previous month"
        >
          ←
        </button>

        <strong>
          {calendarMonth.toLocaleString("default", { month: "long" })}{" "}
          {calendarMonth.getFullYear()}
        </strong>

        <button
          type="button"
          className="calendarMonthNav"
          onClick={() =>
            setCalendarMonth(
              new Date(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth() + 1,
                1
              )
            )
          }
          aria-label="Next month"
        >
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
                const urgency = getUrgency(
                  normalizeDateKey(getTaskDate(task))
                );
                const taskTime = getTaskTime(task);

                return (
                  <button
                    key={`${task.id}-${dateKey}`}
                    type="button"
                    className={`cleanerCalendarEvent ${
                      task.isCleanerJob ? "cleanerCalendarJobEvent" : ""
                    } ${urgency?.className ?? "normal"}`}
                    onClick={() =>
                      onSelectTask?.(normalizeId(task.id))
                    }
                    aria-label={`Open ${getTaskTitle(task)} on ${dateKey}`}
                  >
                    {task.isCleanerJob && (
                      <span className="cleanerCalendarJobBadge">
                        JOB
                      </span>
                    )}

                    <span>{getTaskTitle(task)}</span>

                    {taskTime && (
                      <small className="cleanerCalendarEventTime">
                        {taskTime}
                      </small>
                    )}

                    {isBackToBack(task) && (
                      <span className="calendarB2BBadge">🔁 B2B</span>
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
