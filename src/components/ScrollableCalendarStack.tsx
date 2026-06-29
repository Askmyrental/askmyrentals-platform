type ScrollableCalendarStackProps = {
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

type WeekReservationSegment = {
  reservation: any;
  startColumn: number;
  endColumn: number;
  rowIndex: number;
  startsInWeek: boolean;
  endsInWeek: boolean;
};

export function ScrollableCalendarStack({
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
  getReservationDetailLabel,
  openReservationFromCalendar,
  setSelectedCalendarDateKey,
  setSelectedCalendarItem,
}: ScrollableCalendarStackProps) {
  const months = getStackedCalendarMonths(anchorDate, monthCount);
  const todayKey = toInputDate(new Date());

  
  const toDate = (dateString: string) => new Date(`${dateString}T00:00:00`);

  const getDateKeysBetween = (startKey: string, endKey: string) => {
    const keys: string[] = [];
    const current = toDate(startKey);
    const end = toDate(endKey);

    while (current <= end) {
      keys.push(toInputDate(current));
      current.setDate(current.getDate() + 1);
    }

    return keys;
  };

  const getSourceClass = (source: string) => `source${String(source || "").replace(/\s/g, "")}`;

  const getReservationSegmentsForWeek = (
    weekDays: any[],
    reservations: any[]
  ): WeekReservationSegment[] => {
    const realDays = weekDays.filter((day) => !day.isBlank && day.date);
    if (realDays.length === 0) return [];

    const weekStartKey = toInputDate(realDays[0].date);
    const weekEndKey = toInputDate(realDays[realDays.length - 1].date);

    const segments: WeekReservationSegment[] = [];

    reservations.forEach((reservation) => {
      const reservationStartKey = reservation.arrival;
      const reservationEndKey = reservation.departure;

      if (!reservationStartKey || !reservationEndKey) return;
      if (reservationEndKey < weekStartKey || reservationStartKey > weekEndKey) return;

      const segmentStartKey =
        reservationStartKey > weekStartKey ? reservationStartKey : weekStartKey;
      const segmentEndKey = reservationEndKey < weekEndKey ? reservationEndKey : weekEndKey;

      const startDay = weekDays.find(
        (day) => !day.isBlank && toInputDate(day.date) === segmentStartKey
      );
      const endDay = weekDays.find(
        (day) => !day.isBlank && toInputDate(day.date) === segmentEndKey
      );

      if (!startDay || !endDay) return;

      const startColumn = weekDays.indexOf(startDay) + 1;
      const endColumn = weekDays.indexOf(endDay) + 1;

      const usedRows = new Set(
        segments
          .filter(
            (segment) =>
              !(endColumn < segment.startColumn || startColumn > segment.endColumn)
          )
          .map((segment) => segment.rowIndex)
      );

      let rowIndex = 0;
      while (usedRows.has(rowIndex)) rowIndex += 1;

      segments.push({
        reservation,
        startColumn,
        endColumn,
        rowIndex,
        startsInWeek: reservationStartKey >= weekStartKey,
        endsInWeek: reservationEndKey <= weekEndKey,
      });
    });

    return segments;
  };

  return (
    <div className={`stackedCalendarScroller ${compact ? "compactStackedCalendar" : ""}`}>
      {months.map((monthDate) => {
        const monthDays = getMonthDays(monthDate.getFullYear(), monthDate.getMonth());
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        const isPastMonth = toInputDate(monthEnd) < todayKey;

        const monthReservationsMap = new Map<string, any>();

        monthDays.forEach((day) => {
          if (day.isBlank) return;

          const { dayReservations } = getCalendarDayData(day.date, homeFilter);

          dayReservations.forEach((reservation: any) => {
            if (reservation.type === "Mirror Block") return;
            monthReservationsMap.set(reservation.id, reservation);
          });
        });

        const monthReservations = Array.from(monthReservationsMap.values());

        const weeks: any[][] = [];
        for (let index = 0; index < monthDays.length; index += 7) {
          weeks.push(monthDays.slice(index, index + 7));
        }

        return (
          <section
            className={`stackedMonthCard ${isPastMonth ? "pastCalendarMonth" : ""}`}
            key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
          >
            <div className="stackedMonthHeader">
              <h3>
                {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
                {isPastMonth && <span className="pastMonthLabel">Past</span>}
              </h3>
            </div>

            <div className="stackedWeekdayGrid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-${day}`}>
                  {day}
                </span>
              ))}
            </div>

            <div className="rangeCalendarGrid">
              {weeks.map((weekDays, weekIndex) => {
                const weekReservations = getReservationSegmentsForWeek(
                  weekDays,
                  monthReservations
                );

                return (
                  <div
                    className="rangeCalendarWeek"
                    key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-week-${weekIndex}`}
                  >
                    <div className="rangeCalendarDays">
                      {weekDays.map((day, dayIndex) => {
                        if (day.isBlank) {
                          return (
                            <div
                              className="rangeCalendarDay blankCalendarDay"
                              key={`blank-${monthDate.getFullYear()}-${monthDate.getMonth()}-${weekIndex}-${dayIndex}`}
                            />
                          );
                        }

                        const dateKey = toInputDate(day.date);
                        const isPastDay = dateKey < todayKey;

                        const { dayBlocks, isB2B, hasTasks, hasConflict } =
                          getCalendarDayData(day.date, homeFilter);

                        return (
                          <div
                            className={`rangeCalendarDay ${day.inMonth ? "" : "mutedDay"} ${
                              isPastDay ? "pastCalendarDay" : ""
                            }`}
                            key={`range-day-${dateKey}`}
                            onClick={() => {
                              setSelectedCalendarDateKey(dateKey);
                              setSelectedCalendarItem(null);
                            }}
                          >
                            <div className="dayBadges">
                              {isB2B && <strong className="b2bBadge">B2B</strong>}
                              {hasTasks && <strong className="conflictBadge">Task</strong>}
                              {hasConflict && <strong className="conflictBadge">Conflict</strong>}
                            </div>

                            {dayBlocks.slice(0, 1).map((block: any) => (
                              <button
                                type="button"
                                key={`${dateKey}-${block.id}`}
                                className={`calendarEvent block${block.type.replace(/\s/g, "")}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCalendarDateKey(dateKey);
                                  setSelectedCalendarItem(block);
                                }}
                                title={block.title}
                              >
                                <span>{block.title}</span>
                                <small>{block.type}</small>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className="rangeDateLayer"
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 999999,
                        pointerEvents: "none",
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                      }}
                    >
                      {weekDays.map((day, dayIndex) => {
                        if (day.isBlank) {
                          return <span key={`date-blank-${weekIndex}-${dayIndex}`} />;
                        }

                        return (
                          <span
                            key={`date-${toInputDate(day.date)}`}
                            style={{
                              justifySelf: "end",
                              alignSelf: "start",
                              margin: "4px 5px 0 0",
                              minWidth: "18px",
                              height: "18px",
                              display: "grid",
                              placeItems: "center",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.92)",
                              color: "#0f172a",
                              fontSize: "11px",
                              fontWeight: 900,
                              boxShadow: "0 1px 4px rgba(15,23,42,0.14)",
                            }}
                          >
                            {day.date.getDate()}
                          </span>
                        );
                      })}
                    </div>

                    <div className="rangeReservationLayer">
                      {weekReservations.map((segment) => {
                        const reservation = segment.reservation;
                        const home = homes.find((item: any) => item.id === reservation.homeId);
                        const cleaner = cleaners.find(
                          (item: any) => item.id === reservation.cleanerId
                        );

                        const segmentClasses = [
                          "rangeReservationBar",
                          getSourceClass(reservation.source),
                          segment.startsInWeek ? "rangeStartsInWeek" : "rangeContinuesFromPrevious",
                          segment.endsInWeek ? "rangeEndsInWeek" : "rangeContinuesNext",
                          needsCleanerAssignment(reservation) ? "needsCleanerEvent" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        const dateKeys = getDateKeysBetween(reservation.arrival, reservation.departure);
                        const middleDateKey =
                          dateKeys[Math.floor((dateKeys.length - 1) / 2)] ?? reservation.arrival;

                        return (
                          <button
                            type="button"
                            key={`${reservation.id}-${weekIndex}-${segment.startColumn}-${segment.endColumn}`}
                            className={segmentClasses}
                            style={{
                              gridColumn: `${segment.startColumn} / ${segment.endColumn + 1}`,
                              top: `${38 + segment.rowIndex * 22}px`,
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedCalendarDateKey(middleDateKey);
                              openReservationFromCalendar(reservation);
                            }}
                            title={`${getReservationDisplayTitle(reservation)} · ${home?.name ?? ""}`}
                          >
                            <span>{getReservationDisplayTitle(reservation)}</span>
                            <small>{cleaner?.name ?? getReservationDetailLabel(reservation)}</small>
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
  );
}