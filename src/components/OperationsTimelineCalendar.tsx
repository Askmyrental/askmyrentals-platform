import { mergeProtectionReservations } from "../utils/calendarMerge";
type OperationTimelineCalendarProps = {
  homeFilter?: string;
  anchorDate: Date;
  monthCount?: number;
  compact?: boolean;
  getStackedCalendarMonths: (anchorDate: Date, monthCount: number) => Date[];
  getMonthDays: (year: number, month: number) => any[];
  getCalendarDayData: (
    date: Date,
    homeFilter: string
  ) => {
    dayReservations: any[];
    dayBlocks: any[];
    isB2B: boolean;
    hasTasks: boolean;
    hasConflict: boolean;
  };
  monthNames: string[];
  toInputDate: (date: Date) => string;
  homes: any[];
  cleaners: any[];
  needsCleanerAssignment: (reservation: any) => boolean;
  getReservationDisplayTitle: (reservation: any) => string;
  getReservationDetailLabel: (reservation: any) => string;
  openReservationFromCalendar: (reservation: any) => void;
  setSelectedCalendarDateKey: (value: string) => void;
  setSelectedCalendarItem: (value: any) => void;
};

type WeekSegment = {
  reservation: any;
  leftPercent: number;
  widthPercent: number;
  lane: number;
  startsHere: boolean;
  endsHere: boolean;
  clickDateKey: string;
};

export function OperationTimelineCalendar({
  homeFilter = "all",
  anchorDate,
  monthCount = 12,
  compact = false,
  getStackedCalendarMonths,
  getMonthDays,
  getCalendarDayData,
  monthNames,
  toInputDate,
  homes,
  cleaners,
  needsCleanerAssignment,
  getReservationDisplayTitle,
  openReservationFromCalendar,
  setSelectedCalendarDateKey,
  setSelectedCalendarItem,
}: OperationTimelineCalendarProps) {
 
    
    const months = getStackedCalendarMonths(anchorDate, monthCount);
  const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
    const todayKey = toInputDate(new Date());

  const getReservationStatus = (reservation: any) => {
    if (!reservation) return "unassigned";

    const statusText = String(reservation.status ?? "").trim().toLowerCase();
    const sourceText = String(reservation.source ?? reservation.type ?? "").trim().toLowerCase();

    if (
      statusText === "blocked" ||
      statusText === "no clean needed" ||
      sourceText.includes("owner block")
    ) {
      return "owner-block";
    }

    if (
      statusText === "completed" ||
      statusText === "complete" ||
      statusText.includes("guest ready")
    ) {
      return "completed";
    }

    if (
      statusText === "in process" ||
      statusText === "in-progress" ||
      statusText === "in progress" ||
      statusText.includes("cleaning now") ||
      statusText.includes("started")
    ) {
      return "in-progress";
    }

    if (statusText === "accepted" || statusText.includes("accepted")) {
      return "accepted";
    }

    if (statusText === "assigned" || statusText.includes("waiting for cleaner response")) {
      return "assigned";
    }

    const hasAssignedCleaner =
      Boolean(String(reservation?.cleanerId || "").trim()) ||
      Boolean(String(reservation?.assignedCleanerId || "").trim()) ||
      Boolean(reservation?.assignedCleaner) ||
      Boolean(reservation?.cleaner);

    return hasAssignedCleaner ? "assigned" : "unassigned";
  };

  const getReservationStatusStyle = (status: string) => {
    if (status === "completed") {
      return {
        background: "linear-gradient(135deg, #16a34a, #4ade80)",
        color: "#ffffff",
        border: "1px solid rgba(22, 163, 74, 0.45)",
      };
    }

    if (status === "in-progress") {
      return {
        background: "linear-gradient(135deg, #2563eb, #60a5fa)",
        color: "#ffffff",
        border: "1px solid rgba(37, 99, 235, 0.45)",
      };
    }

    if (status === "accepted") {
      return {
        background: "linear-gradient(135deg, #f97316, #fb923c)",
        color: "#ffffff",
        border: "1px solid rgba(249, 115, 22, 0.45)",
      };
    }

    if (status === "assigned") {
      return {
        background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
        color: "#ffffff",
        border: "1px solid rgba(124, 58, 237, 0.45)",
      };
    }

    if (status === "owner-block") {
      return {
        background: "linear-gradient(135deg, #64748b, #94a3b8)",
        color: "#ffffff",
        border: "1px solid rgba(100, 116, 139, 0.45)",
      };
    }

    return {
      background: "linear-gradient(135deg, #dc2626, #f87171)",
      color: "#ffffff",
      border: "1px solid rgba(220, 38, 38, 0.45)",
    };
  };

  const getCleanerInitials = (reservation: any) => {
    const cleaner =
      cleaners.find((item: any) => item.id === reservation.cleanerId) ||
      reservation.assignedCleaner ||
      reservation.cleaner;

    const cleanerName =
      typeof cleaner === "string"
        ? cleaner
        : cleaner?.name || reservation.cleanerName || "";

    if (!cleanerName || getReservationStatus(reservation) === "unassigned") {
      return "";
    }

    return cleanerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0])
      .join("")
      .toUpperCase();
  };

  const getMonthWeatherChip = (monthDate: Date) => {
    const isCurrentMonth =
      monthDate.getFullYear() === new Date().getFullYear() &&
      monthDate.getMonth() === new Date().getMonth();

    return isCurrentMonth ? "☀️ 89°" : "☀️ 86°";
  };

  const getWeekTodayLeftPercent = (weekDays: any[]) => {
    const todayIndex = weekDays.findIndex(
      (day) => !day.isBlank && day.date && toInputDate(day.date) === todayKey
    );

    if (todayIndex < 0) return null;

    return ((todayIndex + 0.5) / 7) * 100;
  };

  const getUniqueMonthReservations = (monthDays: any[]) => {
    const map = new Map<string, any>();

    const normalizeDateKey = (value: any, fallback?: Date) => {
      if (value instanceof Date) return toInputDate(value);
      if (typeof value === "string" && value.trim()) return value.slice(0, 10);
      if (fallback instanceof Date) return toInputDate(fallback);
      return "";
    };

    const addTimelineItem = (item: any, fallbackDate?: Date) => {
      if (!item) return;

      const arrival = normalizeDateKey(
        item.arrival || item.start || item.startDate || item.checkIn,
        fallbackDate
      );

      if (!arrival) return;

      const rawDeparture = normalizeDateKey(
        item.departure || item.end || item.endDate || item.checkout,
        undefined
      );

      const departure = rawDeparture || addDays(arrival, 1);

      const itemKey = String(
        item.id ||
          item.ical_uid ||
          `${item.homeId || item.home_id || item.propertyId || item.property_id || homeFilter}-${
            item.source || item.type || "Block"
          }-${arrival}-${departure}-${
            item.guestName || item.guest_name || item.title || item.label || item.name || "Block"
          }`
      );

      const normalizedItem = {
        ...item,
        guestName:
          item.guestName ||
          item.guest_name ||
          item.title ||
          item.label ||
          item.name ||
          "Block",
        arrival,
        departure,
        source: item.source || item.type || "Block",
      };

      const existing = map.get(itemKey);

      if (!existing) {
        map.set(itemKey, normalizedItem);
        return;
      }

      map.set(itemKey, {
        ...existing,
        ...normalizedItem,
        arrival: normalizedItem.arrival < existing.arrival ? normalizedItem.arrival : existing.arrival,
        departure:
          normalizedItem.departure > existing.departure
            ? normalizedItem.departure
            : existing.departure,
      });
    };

    const realMonthDays = monthDays.filter((day) => !day.isBlank && day.date);

    if (realMonthDays.length === 0) {
      return [];
    }

    // Important: merge protection blocks using context around the visible month.
    // Airbnb can export one long block that starts in the previous month and
    // only leaves a tiny visible stub in the current month. If we only pass the
    // current month into calendarMerge, it cannot see the prior reservations
    // that explain that stub.
    const contextStart = new Date(realMonthDays[0].date);
    contextStart.setDate(contextStart.getDate() - 45);

    const contextEnd = new Date(realMonthDays[realMonthDays.length - 1].date);
    contextEnd.setDate(contextEnd.getDate() + 45);

    const contextDate = new Date(contextStart);

    while (contextDate <= contextEnd) {
      const { dayReservations } = getCalendarDayData(contextDate, homeFilter);

      dayReservations.forEach((reservation: any) => {
        addTimelineItem(reservation, contextDate);
      });

      contextDate.setDate(contextDate.getDate() + 1);
    }

    return mergeProtectionReservations(Array.from(map.values()));
  };

const buildWeekSegments = (weekDays: any[], reservations: any[]) => {
  const realDays = weekDays
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => !day.isBlank && day.date);

  if (realDays.length === 0) return [] as WeekSegment[];

  const firstRealIndex = realDays[0].index;
  const lastRealIndex = realDays[realDays.length - 1].index;
  const firstRealKey = toInputDate(realDays[0].day.date);
  const lastRealKey = toInputDate(realDays[realDays.length - 1].day.date);
  const segments: WeekSegment[] = [];

  const getDayIndex = (dateKey: string) => {
    const match = realDays.find(({ day }) => toInputDate(day.date) === dateKey);
    return match ? match.index : -1;
  };

  reservations.forEach((reservation) => {
    if (!reservation.arrival || !reservation.departure) return;

    const arrivalKey = String(reservation.arrival).slice(0, 10);
    const departureKey = String(reservation.departure).slice(0, 10);

    // The AMR timeline intentionally shows the checkout/departure day as a
    // half-day continuation. That makes back-to-back turnovers readable.
    // This overlap test is therefore inclusive of departureKey.
    if (arrivalKey > lastRealKey || departureKey < firstRealKey) return;

    const arrivalIndex = getDayIndex(arrivalKey);
    const departureIndex = getDayIndex(departureKey);

    let startOffset =
      arrivalIndex >= 0 ? arrivalIndex + 0.5 : firstRealIndex;

    let endOffset =
      departureIndex >= 0 ? departureIndex + 0.5 : lastRealIndex + 1;

    // Never draw through blank cells before the 1st or after the last day of
    // the month. This is the month-boundary fix.
    startOffset = Math.max(startOffset, firstRealIndex);
    endOffset = Math.min(endOffset, lastRealIndex + 1);

    // Same-day records need a visible pill instead of a zero-width segment.
    if (endOffset <= startOffset && arrivalIndex >= 0 && arrivalIndex === departureIndex) {
      startOffset = Math.max(firstRealIndex, arrivalIndex + 0.12);
      endOffset = Math.min(lastRealIndex + 1, arrivalIndex + 0.88);
    }

    if (endOffset <= startOffset) return;

    const leftPercent = (startOffset / 7) * 100;
    const widthPercent = ((endOffset - startOffset) / 7) * 100;

    const overlappingLanes = new Set(
      segments
        .filter((segment) => {
          const segmentEnd = segment.leftPercent + segment.widthPercent;
          const nextEnd = leftPercent + widthPercent;
          return !(nextEnd <= segment.leftPercent || leftPercent >= segmentEnd);
        })
        .map((segment) => segment.lane)
    );

    let lane = 0;
    while (overlappingLanes.has(lane)) lane += 1;

    segments.push({
      reservation,
      leftPercent,
      widthPercent,
      lane,
      // Rounded left edge only when this segment is the true reservation start.
      // Month/week continuation starts stay square.
      startsHere: arrivalIndex >= 0,
      // Rounded right edge only when this segment is the true reservation end.
      // Month/week continuation ends stay square.
      endsHere: departureIndex >= 0,
      clickDateKey: arrivalIndex >= 0 ? arrivalKey : firstRealKey,
    });
  });

  return segments;
};

  return (
    <>
      <style>{`

        .operationTimelineCalendar {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          display: grid !important;
          gap: 28px !important;
          align-self: stretch !important;
        }

        .calendarPageCalendarBox:has(.operationTimelineCalendar),
        .calendarPanel:has(.operationTimelineCalendar),
        .calendarLayout:has(.operationTimelineCalendar),
        .mainContent:has(.operationTimelineCalendar) {
          width: 100% !important;
          max-width: none !important;
        }

        .operationTimelineCalendar .opsMonthCard {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
        }

        .operationTimelineCalendar .opsWeekdayGrid,
        .operationTimelineCalendar .opsDayGrid {
          display: grid !important;
          grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          width: 100% !important;
        }

        .operationTimelineCalendar .opsBlock,
        .operationTimelineCalendar .opsTimelineBlock,
        .operationTimelineCalendar .operationsReservationBadge,
        .operationTimelineCalendar .stackedCalendarEvent,
        .operationTimelineCalendar .calendarEvent {
          display: none !important;
        }

        @media screen and (min-width: 901px) {
          .calendarPageCalendarBox:has(.operationTimelineCalendar) {
            max-height: none !important;
            overflow: visible !important;
          }

          .calendarPanel:has(.operationTimelineCalendar) {
            overflow: visible !important;
          }

          .operationTimelineCalendar.compactOperationTimelineCalendar {
            max-width: none !important;
          }
        }

        .operationTimelineCalendar .opsReservationBar.status-unassigned,
        .operationTimelineCalendar .opsReservationBar.status-unassigned.needsCleanerEvent {
          background: linear-gradient(135deg, #dc2626, #f87171) !important;
          background-color: #dc2626 !important;
          color: #ffffff !important;
          border: 1px solid rgba(220, 38, 38, 0.65) !important;
        }

      .operationTimelineCalendar .opsReservationBar.status-assigned {
  background: linear-gradient(135deg, #7c3aed, #a78bfa) !important;
  background-color: #7c3aed !important;
  color: #ffffff !important;
  border: 1px solid rgba(124, 58, 237, 0.65) !important;
}
       .operationTimelineCalendar .opsReservationBar.status-accepted {
  background: linear-gradient(135deg, #f97316, #fb923c) !important;
  background-color: #f97316 !important;
  color: #ffffff !important;
  border: 1px solid rgba(249, 115, 22, 0.65) !important;
}

.operationTimelineCalendar .opsReservationBar.status-in-progress {
  background: linear-gradient(135deg, #2563eb, #60a5fa) !important;
  background-color: #2563eb !important;
  color: #ffffff !important;
  border: 1px solid rgba(37, 99, 235, 0.65) !important;
}

        .operationTimelineCalendar .opsReservationBar.status-completed {
          background: linear-gradient(135deg, #16a34a, #4ade80) !important;
          background-color: #16a34a !important;
          color: #ffffff !important;
          border: 1px solid rgba(22, 163, 74, 0.65) !important;
        }

        .operationTimelineCalendar .opsReservationBar .opsSourceBadge {
          background: rgba(255, 255, 255, 0.78) !important;
          color: #0f172a !important;
        }

        .operationTimelineCalendar .opsWeek {
          position: relative;
        }

        .operationTimelineCalendar .opsTodayLine {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          border-radius: 999px;
          background: rgba(14, 165, 233, 0.42);
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.06);
          z-index: 4;
          pointer-events: none;
        }

        .operationTimelineCalendar .opsReservationLayer {
          position: relative;
          z-index: 8;
        }

        .operationTimelineCalendar .opsDayGrid {
          position: relative;
          z-index: 2;
        }

        .operationTimelineCalendar .opsDay.isToday .opsDateNumber {
          background: #0ea5e9;
          color: #ffffff;
          box-shadow: 0 6px 14px rgba(14, 165, 233, 0.3);
        }

        .operationTimelineCalendar .opsMonthHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .operationTimelineCalendar .opsMonthHeader h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .operationTimelineCalendar .opsMonthMeta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: nowrap;
        }

        .operationTimelineCalendar .opsWeatherChip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(248, 250, 252, 0.96);
          color: #334155;
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 850;
          line-height: 1.15;
          box-shadow: 0 5px 12px rgba(15, 23, 42, 0.05);
          white-space: nowrap;
        }


        .operationTimelineCalendar .opsReservationContent {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          overflow: hidden;
          white-space: nowrap;
          pointer-events: none;
        }

        .operationTimelineCalendar .opsReservationTitle {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1;
        }

        .operationTimelineCalendar .opsSourceBadge {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 1px 5px;
          background: rgba(255, 255, 255, 0.78);
          color: #0f172a;
          font-size: 7px;
          font-style: normal;
          font-weight: 950;
          line-height: 1.25;
          text-transform: uppercase;
          letter-spacing: 0.035em;
        }

        .operationTimelineCalendar .opsProtectionBadge {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 1px 5px;
          background: rgba(255, 255, 255, 0.22);
          color: currentColor;
          font-size: 7px;
          font-weight: 950;
          line-height: 1.25;
          text-transform: uppercase;
          letter-spacing: 0.035em;
        }

        .operationTimelineCalendar .opsCleanerInitials,
        .operationTimelineCalendar .opsWarningBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          min-width: 16px;
          height: 15px;
          padding: 0 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.24);
          color: currentColor;
          font-size: 7px;
          font-weight: 950;
          line-height: 1;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
        }

        .operationTimelineCalendar .opsWarningBadge {
          min-width: 15px;
          padding: 0;
          background: rgba(255, 255, 255, 0.28);
        }

        .operationTimelineCalendar .opsReservationBar {
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            background 220ms ease,
            border-color 220ms ease;
        }



        .operationTimelineCalendar .opsReservationBar.continuesFromPrevious {
          border-top-left-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }

        .operationTimelineCalendar .opsReservationBar.continuesNext {
          border-top-right-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }

        .operationTimelineCalendar .opsReservationBar.startsHere {
          border-top-left-radius: 999px !important;
          border-bottom-left-radius: 999px !important;
        }

        .operationTimelineCalendar .opsReservationBar.endsHere {
          border-top-right-radius: 999px !important;
          border-bottom-right-radius: 999px !important;
        }

        .operationTimelineCalendar .opsReservationBar:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.22) !important;
        }
      `}</style>

      <div className={`operationTimelineCalendar ${compact ? "compactOperationTimelineCalendar" : ""}`}>
      {months.map((monthDate) => {
        const monthDays = getMonthDays(monthDate.getFullYear(), monthDate.getMonth());
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        const isPastMonth = toInputDate(monthEnd) < todayKey;
        const monthReservations = getUniqueMonthReservations(monthDays);

        const weeks: any[][] = [];
        for (let index = 0; index < monthDays.length; index += 7) {
          weeks.push(monthDays.slice(index, index + 7));
        }

        const firstVisibleSegmentWeekByReservationId = new Map<string, number>();
        const labelSegmentWeekByReservationId = new Map<string, number>();

        weeks.forEach((weekDays, weekIndex) => {
          buildWeekSegments(weekDays, monthReservations).forEach((segment) => {
            const reservationId = String(segment.reservation?.id ?? "");

            if (!reservationId) return;

            if (!firstVisibleSegmentWeekByReservationId.has(reservationId)) {
              firstVisibleSegmentWeekByReservationId.set(reservationId, weekIndex);
            }

            // If a reservation starts on Saturday, its true first segment is too narrow
            // to hold the source/cleaner/name. Put the label on the first wider
            // continuation segment instead so the reservation is still readable.
            if (!labelSegmentWeekByReservationId.has(reservationId) && segment.widthPercent > 18) {
              labelSegmentWeekByReservationId.set(reservationId, weekIndex);
            }
          });
        });

        firstVisibleSegmentWeekByReservationId.forEach((weekIndex, reservationId) => {
          if (!labelSegmentWeekByReservationId.has(reservationId)) {
            labelSegmentWeekByReservationId.set(reservationId, weekIndex);
          }
        });

        return (
          <section
            className={`opsMonthCard ${isPastMonth ? "pastCalendarMonth" : ""}`}
            key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
          >
            <div className="opsMonthHeader">
              <h3>
                {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
                {isPastMonth && <span className="pastMonthLabel">Past</span>}
              </h3>

              <div className="opsMonthMeta">
                <span className="opsWeatherChip">{getMonthWeatherChip(monthDate)}</span>
              </div>
            </div>

            <div className="opsWeekdayGrid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-${day}`}>{day}</span>
              ))}
            </div>

            <div className="opsWeeks">
              {weeks.map((weekDays, weekIndex) => {
                const weekSegments = buildWeekSegments(weekDays, monthReservations);
                const maxLane = weekSegments.reduce(
                  (highest, segment) => Math.max(highest, segment.lane),
                  0
                );
                const todayLeftPercent = getWeekTodayLeftPercent(weekDays);

                return (
                  <div
                    className="opsWeek"
                    key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-${weekIndex}`}
                    style={{ minHeight: `${82 + maxLane * 28}px` }}
                  >
                    <div className="opsDayGrid">
                      {weekDays.map((day, dayIndex) => {
                        if (day.isBlank || !day.date) {
                          return (
                            <div
                              className="opsDay blankCalendarDay"
                              key={`ops-blank-${monthDate.getFullYear()}-${monthDate.getMonth()}-${weekIndex}-${dayIndex}`}
                            />
                          );
                        }

                        const dateKey = toInputDate(day.date);
                        const isPastDay = dateKey < todayKey;
                        const isToday = dateKey === todayKey;
                        const { isB2B, hasTasks, hasConflict } = getCalendarDayData(
                          day.date,
                          homeFilter
                        );

                        return (
                          <button
                            type="button"
                            className={`opsDay ${day.inMonth ? "" : "mutedDay"} ${
                              isPastDay ? "pastCalendarDay" : ""
                            } ${isToday ? "isToday" : ""}`}
                            key={`ops-day-${dateKey}`}
                            onClick={() => {
                              setSelectedCalendarDateKey(dateKey);
                              setSelectedCalendarItem(null);
                            }}
                          >
                            <span className="opsDateNumber">{day.date.getDate()}</span>

                            <span className="opsDayBadges">
                              {isB2B && <strong className="b2bBadge">B2B</strong>}
                              {hasTasks && <strong className="conflictBadge">Task</strong>}
                              {hasConflict && <strong className="conflictBadge">Conflict</strong>}
                            </span>

                          </button>
                        );
                      })}
                    </div>

                    {todayLeftPercent !== null && (
                      <div
                        className="opsTodayLine"
                        style={{ left: `${todayLeftPercent}%` }}
                      />
                    )}

                    <div className="opsReservationLayer">
                    {weekSegments.map((segment) => {
  const reservation = segment.reservation;

  const home = homes.find((item: any) => item.id === reservation.homeId);
                      

                        const status = getReservationStatus(reservation);
                        const statusStyle = getReservationStatusStyle(status);
                        const sourceLabel = reservation.source || reservation.type || "Owner";
                        const cleanerInitials = getCleanerInitials(reservation);
                        const hasWarning = needsCleanerAssignment(reservation);
                        const showSegmentContent =
                          labelSegmentWeekByReservationId.get(String(reservation.id)) === weekIndex;
                        const normalizedSourceLabel = String(sourceLabel)
                          .replace(/Guest Reservation/i, "Guest")
                          .replace(/Owner Block/i, "Owner")
                          .replace(/Vendor Visit/i, "Vendor")
                          .toUpperCase();
                        const reservationTitle = getReservationDisplayTitle(reservation);
                        const protectedOn = Array.isArray(reservation.protectedOn)
                          ? reservation.protectedOn.filter(Boolean)
                          : [];
                        const protectionLabel = protectedOn.length
                          ? `${protectedOn.join("+")} ✓`
                          : "";
                        const hasRoomForSourceBadge =
                          showSegmentContent && segment.widthPercent > 18;
                        const hasRoomForTitle =
                          showSegmentContent && segment.widthPercent > 11;
                        const hasRoomForCleaner =
                          showSegmentContent && segment.widthPercent > 20;
                        const hasRoomForWarning =
                          showSegmentContent && segment.widthPercent > 16;
                        const hasRoomForProtection =
                          showSegmentContent && Boolean(protectionLabel) && segment.widthPercent > 34;

                        const className = [
                          "opsReservationBar",
                          `status-${status}`,
                          segment.startsHere ? "startsHere" : "continuesFromPrevious",
                          segment.endsHere ? "endsHere" : "continuesNext",
                          needsCleanerAssignment(reservation) ? "needsCleanerEvent" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <button
                            type="button"
                            key={`${reservation.id}-${weekIndex}-${segment.leftPercent}`}
                            className={className}
                            style={{
                              left: `${segment.leftPercent}%`,
                              width: `${segment.widthPercent}%`,
                              top: `${54 + segment.lane * 28}px`,
                              minHeight: "26px",
                              padding: "3px 8px",
                              borderRadius: segment.startsHere && segment.endsHere
                                ? "999px"
                                : segment.startsHere
                                  ? "999px 0 0 999px"
                                  : segment.endsHere
                                    ? "0 999px 999px 0"
                                    : "0",
                              boxShadow: "0 8px 18px rgba(15, 23, 42, 0.18)",
                              ...statusStyle,
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedCalendarDateKey(segment.clickDateKey);
                              openReservationFromCalendar(reservation);
                            }}
                            title={`${reservationTitle} · ${home?.name ?? ""}`}
                          >
                            {showSegmentContent && (
                              <span className="opsReservationContent">
                                {hasRoomForSourceBadge && (
                                  <em className="opsSourceBadge">
                                    {normalizedSourceLabel}
                                  </em>
                                )}

                                {hasWarning && hasRoomForWarning && (
                                  <span className="opsWarningBadge" title="Needs attention">
                                    ⚠
                                  </span>
                                )}

                                {!hasWarning && cleanerInitials && hasRoomForCleaner && (
                                  <span className="opsCleanerInitials" title="Assigned cleaner">
                                    {cleanerInitials}
                                  </span>
                                )}

                                {hasRoomForTitle && (
                                  <strong className="opsReservationTitle">
                                    {reservationTitle}
                                  </strong>
                                )}

                                {hasRoomForProtection && (
                                  <span className="opsProtectionBadge" title="Protected on matching platform">
                                    {protectionLabel}
                                  </span>
                                )}
                              </span>
                            )}

                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      </div>
    </>
  );
}

