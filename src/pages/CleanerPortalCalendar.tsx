import { useState } from "react";

type CleanerPortalCalendarProps = {
  cleanerTasks: any[];
  homes: any[];
  getUrgency: (date: string) => any;
  onSelectTask?: (taskId: string) => void;
  isAssignedTeamCleaner?: boolean;
};

export default function CleanerPortalCalendar({
  cleanerTasks,
  homes,
  getUrgency,
  onSelectTask,
  isAssignedTeamCleaner = false,
}: CleanerPortalCalendarProps) {
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [previewDayKey, setPreviewDayKey] = useState<string | null>(null);

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

  const isAirbnbBlock = (task: any) =>
    String(task.source ?? "").toLowerCase() === "airbnb" &&
    String(task.status ?? "").toLowerCase() === "blocked";

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

  const isOwnerStay = (task: any) =>
    String(task.source ?? "").toLowerCase() === "owner block";

  const isNoCleanNeeded = (task: any) =>
    String(task.status ?? "").toLowerCase() === "no clean needed";

  const getTaskTitle = (task: any) => {
    if (task.isCleanerJob) {
      return task.jobType ?? task.taskType ?? "Independent Job";
    }

    const home = homes.find(
      (item) => normalizeId(item.id) === normalizeId(task.homeId)
    );

    if (isOwnerStay(task) && isNoCleanNeeded(task)) {
      return `${home?.name ?? "Property"} · Owner Stay`;
    }

    if (isAirbnbBlock(task)) {
      return `${home?.name ?? "Property"} · Airbnb Block Ends`;
    }

    return home?.name ?? "Cleaning";
  };

  const getTaskSubtitle = (task: any) => {
    if (task.isCleanerJob) {
      return task.customerName ?? task.clientName ?? "Independent job";
    }

    if (isOwnerStay(task)) {
      return isNoCleanNeeded(task)
        ? "Owner Stay • No Clean"
        : "Owner stay turnover";
    }

    if (isAirbnbBlock(task)) {
      return `Blocked ${normalizeDateKey(task.arrival)} through ${normalizeDateKey(
        task.departure
      )} • Informational only`;
    }

    return task.guestName ?? task.title ?? "Turnover cleaning";
  };

  const getTaskStatus = (task: any) => {
    const normalizedStatus = String(task.status ?? "").toLowerCase();
    const normalizedInvoiceStatus = String(task.invoiceStatus ?? "").toLowerCase();

    if (isAirbnbBlock(task)) {
      return { label: "Blocked", className: "blocked" };
    }

    if (normalizedStatus === "no clean needed") {
      return { label: "Owner Stay • No Clean", className: "no-clean" };
    }

    if (isAssignedTeamCleaner) {
      if (
        normalizedInvoiceStatus === "paid" ||
        normalizedStatus === "paid" ||
        normalizedInvoiceStatus === "overdue" ||
        task.invoiceSent ||
        normalizedStatus.includes("invoice sent") ||
        normalizedStatus.includes("invoiced") ||
        ["sent", "viewed"].includes(normalizedInvoiceStatus) ||
        normalizedStatus.includes("complete")
      ) {
        return { label: "Completed", className: "completed" };
      }
    }

    if (normalizedInvoiceStatus === "paid" || normalizedStatus === "paid") {
      return { label: "Paid", className: "paid" };
    }

    if (normalizedInvoiceStatus === "overdue") {
      return { label: "Overdue", className: "overdue" };
    }

    if (
      task.invoiceSent ||
      normalizedStatus.includes("invoice sent") ||
      normalizedStatus.includes("invoiced") ||
      ["sent", "viewed"].includes(normalizedInvoiceStatus)
    ) {
      return { label: "Invoiced", className: "invoiced" };
    }

    if (normalizedStatus.includes("complete")) {
      return { label: "Needs Invoice", className: "needs-invoice" };
    }

    if (
      normalizedStatus.includes("progress") ||
      normalizedStatus.includes("process") ||
      normalizedStatus.includes("started")
    ) {
      return { label: "In Progress", className: "in-progress" };
    }

    return { label: "Upcoming", className: "upcoming" };
  };

  const getEstimatedPay = (task: any) => {
    const value =
      task.cleaningFee ??
      task.amount ??
      task.invoiceAmount ??
      task.price ??
      null;

    if (value === null || value === "") return "Set on invoice";

    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(numericValue)
      : "Set on invoice";
  };

  const selectedDayTasks = selectedDay ? tasksForDay(selectedDay) : [];

  const isTouchDevice = () =>
    typeof window !== "undefined" &&
    (window.matchMedia("(hover: none)").matches || navigator.maxTouchPoints > 0);

  function handleDayTaskClick(day: Date) {
    const key = toDateKey(day);
    if (isTouchDevice() && previewDayKey !== key) {
      setPreviewDayKey(key);
      return;
    }
    setPreviewDayKey(null);
    setSelectedDay(day);
  }

  function openTask(task: any) {
    // Keep the selected day open behind the task card.
    // When the task card closes, the cleaner returns to this day's task list.
    onSelectTask?.(normalizeId(task.id));
  }

  return (
    <section className="cleanerCalendarPanel" id="cleanerPortalCalendar">
      <style>{`
        .cleanerCalendarTaskCountButton {
          width: 100%;
          min-height: 42px;
          margin-top: 8px;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 6px;
          font-weight: 900;
          cursor: pointer;
        }

        .cleanerCalendarTaskCountButton:hover {
          border-color: #93c5fd;
          background: #dbeafe;
        }

        .cleanerCalendarTaskCountButton strong {
          font-size: 14px;
        }

        .cleanerCalendarTaskCountMobile {
          display: none;
          line-height: 1;
          white-space: nowrap;
        }

        .cleanerCalendarTaskCountDesktop {
          display: inline;
          line-height: 1;
          white-space: nowrap;
        }

        .cleanerCalendarDay.hasTasks {
          min-height: 84px;
        }

        .cleanerCalendarDay.pastCalendarDay {
          background: rgba(59, 130, 246, 0.06);
          opacity: 0.62;
        }

        .cleanerCalendarDay.pastCalendarDay:hover,
        .cleanerCalendarDay.pastCalendarDay:focus-within {
          opacity: 0.86;
        }

        .cleanerCalendarDay.todayCalendarDay {
          outline: 2px solid rgba(37, 99, 235, 0.42);
          outline-offset: -2px;
          background: rgba(219, 234, 254, 0.72);
        }

        .cleanerCalendarDay.pastCalendarDay .cleanerCalendarTaskCountButton {
          background: rgba(219, 234, 254, 0.72);
          border-color: rgba(147, 197, 253, 0.8);
        }

        .cleanerCalendarDay { position: relative; }
        .cleanerCalendarInlinePreview { display:grid; gap:3px; width:100%; min-width:0; text-align:left; }
        .cleanerCalendarInlinePreviewRow { display:flex; align-items:center; gap:5px; min-width:0; font-size:10px; font-weight:800; line-height:1.15; }
        .cleanerCalendarInlinePreviewRow span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cleanerCalendarMoreCount { color:#64748b; font-size:9px; font-weight:800; }
        .cleanerCalendarHoverPreview { position:absolute; left:50%; bottom:calc(100% + 12px); z-index:30; width:min(310px,72vw); transform:translateX(-50%); padding:12px; border:1px solid #dbe3ee; border-radius:14px; background:#fff; box-shadow:0 18px 48px rgba(15,23,42,.22); text-align:left; }
        .cleanerCalendarHoverPreview.alignLeft { left:0; transform:none; }
        .cleanerCalendarHoverPreview.alignRight { left:auto; right:0; transform:none; }
        @media (hover: hover) and (pointer: fine) {
          .cleanerCalendarHoverPreview {
            pointer-events: none;
          }
        }
        .cleanerCalendarHoverPreview::after { content:""; position:absolute; left:50%; top:100%; width:12px; height:12px; transform:translate(-50%,-6px) rotate(45deg); border-right:1px solid #dbe3ee; border-bottom:1px solid #dbe3ee; background:#fff; }
        .cleanerCalendarHoverPreview.alignLeft::after { left:28px; transform:translate(0,-6px) rotate(45deg); }
        .cleanerCalendarHoverPreview.alignRight::after { left:auto; right:28px; transform:translate(0,-6px) rotate(45deg); }
        .cleanerCalendarHoverPreviewHeader { margin-bottom:8px; color:#0f172a; font-size:12px; font-weight:900; }
        .cleanerCalendarHoverTask { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:7px 0; border-top:1px solid #eef2f7; }
        .cleanerCalendarHoverTask:first-of-type { border-top:0; }
        .cleanerCalendarHoverTask strong,.cleanerCalendarHoverTask small { display:block; }
        .cleanerCalendarHoverTask strong { overflow:hidden; color:#0f172a; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
        .cleanerCalendarHoverTask small { margin-top:2px; color:#64748b; font-size:10px; }
        .cleanerCalendarHoverStatus { border-radius:999px; padding:4px 7px; font-size:9px; font-weight:900; white-space:nowrap; }
        .cleanerCalendarHoverStatus.upcoming { background:#f1f5f9; color:#475569; }
        .cleanerCalendarHoverStatus.in-progress { background:#dbeafe; color:#1d4ed8; }
        .cleanerCalendarHoverStatus.needs-invoice { background:#dcfce7; color:#15803d; }
        .cleanerCalendarHoverStatus.completed { background:#dcfce7; color:#166534; }
        .cleanerCalendarHoverStatus.invoiced { background:#fef3c7; color:#a16207; }
        .cleanerCalendarHoverStatus.paid { background:#dcfce7; color:#166534; }
        .cleanerCalendarHoverStatus.overdue { background:#fee2e2; color:#b91c1c; }
        .cleanerCalendarHoverStatus.no-clean { background:#f1f5f9; color:#64748b; }
        .cleanerCalendarHoverStatus.blocked { background:#e2e8f0; color:#475569; }

        .cleanerDaySheetOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000000;
          display: grid;
          align-items: end;
          padding: 16px;
          padding-bottom: calc(96px + env(safe-area-inset-bottom));
          background: rgba(15, 23, 42, 0.48);
        }

        .cleanerDaySheet {
          width: min(620px, 100%);
          max-height: min(76vh, 720px);
          margin: 0 auto;
          overflow: auto;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
        }

        .cleanerDaySheetHeader {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 20px 20px 16px;
          border-bottom: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
        }

        .cleanerDaySheetHeader p {
          margin: 0 0 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .cleanerDaySheetHeader h2 {
          margin: 0;
          color: #0f172a;
          font-size: 23px;
        }

        .cleanerDaySheetClose {
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 999px;
          background: #f1f5f9;
          color: #334155;
          font-size: 20px;
          font-weight: 900;
        }

        .cleanerDayTaskList {
          display: grid;
          gap: 10px;
          padding: 16px 20px 22px;
        }

        .cleanerDayTaskButton {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #ffffff;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 15px;
          text-align: left;
          cursor: pointer;
        }

        .cleanerDayTaskButton.informational {
          cursor: default;
          opacity: 0.78;
          background: #f8fafc;
        }

        .cleanerDayTaskButton:not(.informational):hover {
          border-color: #93c5fd;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }

        .cleanerDayTaskMain {
          min-width: 0;
        }

        .cleanerDayTaskType {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          color: #2563eb;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .cleanerDayTaskMain strong {
          display: block;
          color: #0f172a;
          font-size: 16px;
        }

        .cleanerDayTaskMain span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 13px;
        }

        .cleanerDayTaskMeta {
          display: grid;
          justify-items: end;
          align-content: start;
          gap: 7px;
        }

        .cleanerDayTaskTime {
          color: #334155;
          font-size: 13px;
          font-weight: 900;
        }

        .cleanerDayTaskBadge {
          border-radius: 999px;
          padding: 5px 8px;
          background: #fff7ed;
          color: #c2410c;
          font-size: 10px;
          font-weight: 900;
        }

        .cleanerDayTaskArrow {
          color: #94a3b8;
          font-size: 18px;
          font-weight: 900;
        }

        .cleanerDayTaskStatus {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .cleanerDayTaskStatus.upcoming {
          background: #f1f5f9;
          color: #475569;
        }

        .cleanerDayTaskStatus.in-progress {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .cleanerDayTaskStatus.needs-invoice {
          background: #dcfce7;
          color: #15803d;
        }

        .cleanerDayTaskStatus.completed {
          background: #dcfce7;
          color: #166534;
        }

        .cleanerDayTaskStatus.invoiced {
          background: #fef3c7;
          color: #a16207;
        }

        .cleanerDayTaskStatus.paid {
          background: #dcfce7;
          color: #166534;
        }

        .cleanerDayTaskStatus.overdue {
          background: #fee2e2;
          color: #b91c1c;
        }

        .cleanerDayTaskStatus.no-clean {
          background: #f1f5f9;
          color: #64748b;
        }

        .cleanerDayTaskStatus.blocked {
          background: #e2e8f0;
          color: #475569;
        }

        .cleanerDayTaskPay {
          margin-top: 8px !important;
          color: #334155 !important;
          font-size: 12px !important;
          font-weight: 800;
        }

        @media (min-width: 901px) {
          .cleanerDaySheetOverlay {
            align-items: center;
            padding-bottom: 16px;
          }
        }

        @media (max-width: 700px) {
          .cleanerCalendarDay {
            min-height: 72px;
          }

          .cleanerCalendarDay.hasTasks {
            min-height: 76px;
          }

          .cleanerCalendarTaskCountButton {
            min-height: 36px;
            margin-top: 5px;
            padding: 5px 3px;
            font-size: 12px;
          }

          .cleanerCalendarTaskCountMobile {
            display: inline;
            font-size: 12px;
          }

          .cleanerCalendarTaskCountDesktop { display: none; }
          .cleanerCalendarInlinePreview { display: none; }
          .cleanerCalendarHoverPreview { position:fixed; left:12px; right:12px; bottom:calc(92px + env(safe-area-inset-bottom)); z-index:1000002; width:auto; transform:none; }
          .cleanerCalendarHoverPreview::after { display:none; }

          .cleanerDaySheetOverlay {
            padding: 0;
            padding-bottom: calc(80px + env(safe-area-inset-bottom));
          }

          .cleanerDaySheet {
            width: 100%;
            max-height: calc(88dvh - 80px);
            border-radius: 24px 24px 0 0;
          }

          .cleanerDaySheetHeader {
            padding: 18px 16px 14px;
          }

          .cleanerDayTaskList {
            padding: 14px 14px 20px;
          }
        }
      `}</style>

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
          const todayKey = toDateKey(today);
          const isPastDay = dateKey < todayKey;
          const isToday = dateKey === todayKey;
          const mobileTaskLabel = `🧹 ×${dayTasks.length}`;
          const dayColumn = day.getDay();
          const hoverAlignmentClass =
            dayColumn <= 1
              ? "alignLeft"
              : dayColumn >= 5
                ? "alignRight"
                : "";

          return (
            <div
              key={dateKey}
              className={`cleanerCalendarDay ${
                isCurrentMonth ? "" : "mutedCalendarDay"
              } ${dayTasks.length > 0 ? "hasTasks" : ""} ${
                isPastDay ? "pastCalendarDay" : ""
              } ${isToday ? "todayCalendarDay" : ""}`}
              onMouseEnter={() => {
                if (dayTasks.length > 0 && !isTouchDevice()) {
                  setPreviewDayKey(dateKey);
                }
              }}
              onMouseLeave={() => {
                if (!isTouchDevice()) {
                  setPreviewDayKey(null);
                }
              }}
            >
              <button
                type="button"
                className="cleanerCalendarDateNumber"
                onClick={() => dayTasks.length > 0 && setSelectedDay(day)}
                aria-label={
                  dayTasks.length > 0
                    ? `Open ${dayTasks.length} tasks on ${dateKey}`
                    : dateKey
                }
                disabled={dayTasks.length === 0}
              >
                {day.getDate()}
              </button>

              {dayTasks.length > 0 && (
                <button
                  type="button"
                  className="cleanerCalendarTaskCountButton"
                  onClick={() => handleDayTaskClick(day)}
                  aria-label={`Preview ${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"} on ${dateKey}`}
                >
                  <span className="cleanerCalendarTaskCountMobile" aria-hidden="true">{mobileTaskLabel}</span>
                  <span className="cleanerCalendarInlinePreview" aria-hidden="true">
                    {dayTasks.slice(0, 2).map((task) => (
                      <span className="cleanerCalendarInlinePreviewRow" key={normalizeId(task.id)}>
                        <span>{task.isCleanerJob ? "💼" : "🏠"}</span><span>{getTaskTitle(task)}</span>
                      </span>
                    ))}
                    {dayTasks.length > 2 && <span className="cleanerCalendarMoreCount">+{dayTasks.length - 2} more</span>}
                  </span>
                </button>
              )}

              {dayTasks.length > 0 && previewDayKey === dateKey && (
                <div
                  className={`cleanerCalendarHoverPreview ${hoverAlignmentClass}`}
                >
                  <div className="cleanerCalendarHoverPreviewHeader">
                    {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                  </div>
                  {dayTasks.slice(0, 4).map((task) => {
                    const taskStatus = getTaskStatus(task);
                    const taskTime = getTaskTime(task);
                    return (
                      <div className="cleanerCalendarHoverTask" key={normalizeId(task.id)}>
                        <div><strong>{task.isCleanerJob ? "💼 " : "🏠 "}{getTaskTitle(task)}</strong><small>{taskTime || getTaskSubtitle(task)}</small></div>
                        <span className={`cleanerCalendarHoverStatus ${taskStatus.className}`}>{taskStatus.label}</span>
                      </div>
                    );
                  })}
                  {dayTasks.length > 4 && <small className="cleanerCalendarMoreCount">+{dayTasks.length - 4} more tasks</small>}
                  {isTouchDevice() && (
                    <button type="button" className="secondaryButton" style={{ width: "100%", marginTop: 8 }} onClick={() => { setPreviewDayKey(null); setSelectedDay(day); }}>Open Day</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div
          className="cleanerDaySheetOverlay"
          role="presentation"
          onClick={() => setSelectedDay(null)}
        >
          <section
            className="cleanerDaySheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedDayTasks.length} tasks on ${selectedDay.toLocaleDateString()}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cleanerDaySheetHeader">
              <div>
                <p>
                  🧹 {selectedDayTasks.length}{" "}
                  {selectedDayTasks.length === 1 ? "task" : "tasks"}
                </p>
                <h2>
                  {selectedDay.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
              </div>

              <button
                className="cleanerDaySheetClose"
                type="button"
                onClick={() => setSelectedDay(null)}
                aria-label="Close task list"
              >
                ×
              </button>
            </header>

            <div className="cleanerDayTaskList">
              {selectedDayTasks.map((task) => {
                const taskTime = getTaskTime(task);
                const backToBack = isBackToBack(task);
                const urgency = getUrgency(
                  normalizeDateKey(getTaskDate(task))
                );
                const taskStatus = getTaskStatus(task);
                const estimatedPay = getEstimatedPay(task);

                return (
                  <button
                    key={normalizeId(task.id)}
                    type="button"
                    className="cleanerDayTaskButton"
                    onClick={() => openTask(task)}
                  >
                    <div className="cleanerDayTaskMain">
                      <span className="cleanerDayTaskType">
                        {task.isCleanerJob
                          ? "💼 Job"
                          : isOwnerStay(task)
                            ? "🏠 Owner Stay"
                            : isAirbnbBlock(task)
                              ? "🏠 Airbnb Block Turnover"
                              : "🏠 Turnover"}
                      </span>
                      <strong>{getTaskTitle(task)}</strong>
                      <span>{getTaskSubtitle(task)}</span>
                      {!isNoCleanNeeded(task) && !isAirbnbBlock(task) && (
                        <span className="cleanerDayTaskPay">
                          Estimated Pay: {estimatedPay}
                        </span>
                      )}
                    </div>

                    <div className="cleanerDayTaskMeta">
                      {taskTime && (
                        <span className="cleanerDayTaskTime">{taskTime}</span>
                      )}
                      {backToBack && (
                        <span className="cleanerDayTaskBadge">🔁 B2B</span>
                      )}
                      <span
                        className={`cleanerDayTaskStatus ${taskStatus.className}`}
                      >
                        {taskStatus.label}
                      </span>
                      {urgency?.label && (
                        <span className="cleanerDayTaskBadge">
                          {urgency.label}
                        </span>
                      )}
                      {!isAirbnbBlock(task) && (
                        <span className="cleanerDayTaskArrow" aria-hidden="true">
                          →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
