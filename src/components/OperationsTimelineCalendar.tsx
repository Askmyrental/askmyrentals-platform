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
  getReservationDetailLabel,
  openReservationFromCalendar,
  setSelectedCalendarDateKey,
  setSelectedCalendarItem,
}: OperationTimelineCalendarProps) {
  const months = getStackedCalendarMonths(anchorDate, monthCount);
  const todayKey = toInputDate(new Date());

  const toDate = (dateString: string) => new Date(`${dateString}T00:00:00`);

  const getSourceClass = (source: string) =>
    `source${String(source || "").replace(/\s/g, "")}`;

  const daysBetween = (startKey: string, endKey: string) => {
    const start = toDate(startKey).getTime();
    const end = toDate(endKey).getTime();
    return Math.round((end - start) / 86400000);
  };

  const getUniqueMonthReservations = (monthDays: any[]) => {
    const map = new Map<string, any>();

    monthDays.forEach((day) => {
      if (day.isBlank || !day.date) return;

      const { dayReservations } = getCalendarDayData(day.date, homeFilter);

      dayReservations.forEach((reservation: any) => {
        if (!reservation?.id) return;
        if (reservation.type === "Mirror Block") return;
        map.set(reservation.id, reservation);
      });
    });

    return Array.from(map.values());
  };

const buildWeekSegments = (weekDays: any[], reservations: any[]) => {
  const firstRealIndex = weekDays.findIndex((day) => !day.isBlank && day.date);
  const firstRealDay = weekDays[firstRealIndex];

  if (!firstRealDay) return [] as WeekSegment[];

  const weekStartDate = new Date(firstRealDay.date);
  weekStartDate.setDate(weekStartDate.getDate() - firstRealIndex);

  const weekStartKey = toInputDate(weekStartDate);
  const segments: WeekSegment[] = [];

  reservations.forEach((reservation) => {
    if (!reservation.arrival || !reservation.departure) return;

    const arrivalOffset = daysBetween(weekStartKey, reservation.arrival);
    const departureOffset = daysBetween(weekStartKey, reservation.departure);

    const rawStart = arrivalOffset + 0.5;
    const rawEnd = departureOffset + 0.5;

    if (rawEnd <= 0 || rawStart >= 7) return;

    const startOffset = Math.max(0, rawStart);
    const endOffset = Math.min(7, rawEnd);

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
      startsHere: rawStart >= 0,
      endsHere: rawEnd <= 7,
      clickDateKey: reservation.arrival,
    });
  });

  return segments;
};

  return (
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

                return (
                  <div
                    className="opsWeek"
                    key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-${weekIndex}`}
                    style={{ minHeight: `${78 + maxLane * 22}px` }}
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
                        const { dayBlocks, isB2B, hasTasks, hasConflict } = getCalendarDayData(
                          day.date,
                          homeFilter
                        );

                        return (
                          <button
                            type="button"
                            className={`opsDay ${day.inMonth ? "" : "mutedDay"} ${
                              isPastDay ? "pastCalendarDay" : ""
                            }`}
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

                            {dayBlocks.slice(0, 1).map((block: any) => (
                              <span
                                key={`${dateKey}-${block.id}`}
                                className={`opsBlock block${block.type.replace(/\s/g, "")}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCalendarDateKey(dateKey);
                                  setSelectedCalendarItem(block);
                                }}
                              >
                                {block.title}
                              </span>
                            ))}
                          </button>
                        );
                      })}
                    </div>

                    <div className="opsReservationLayer">
                      {weekSegments.map((segment) => {
                        const reservation = segment.reservation;
                        const home = homes.find((item: any) => item.id === reservation.homeId);
                        const cleaner = cleaners.find(
                          (item: any) => item.id === reservation.cleanerId
                        );

                        const className = [
                          "opsReservationBar",
                          getSourceClass(reservation.source),
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
                            top: `${52 + segment.lane * 20}px`
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedCalendarDateKey(segment.clickDateKey);
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
