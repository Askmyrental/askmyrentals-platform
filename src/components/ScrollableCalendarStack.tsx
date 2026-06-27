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

  return (
    <div className={`stackedCalendarScroller ${compact ? "compactStackedCalendar" : ""}`}>
      {months.map((monthDate) => {
        const monthDays = getMonthDays(monthDate.getFullYear(), monthDate.getMonth());

        return (
          <section className="stackedMonthCard" key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}>
            <div className="stackedMonthHeader">
              <h3>
                {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
              </h3>
            </div>

            <div className="stackedWeekdayGrid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={`${monthDate.getFullYear()}-${monthDate.getMonth()}-${day}`}>{day}</span>
              ))}
            </div>

            <div className="stackedCalendarGrid">
              {monthDays.map((day, dayIndex) => {
                if (day.isBlank) {
                  return (
                    <div
                      className="stackedCalendarDay blankCalendarDay"
                      key={`blank-${monthDate.getFullYear()}-${monthDate.getMonth()}-${dayIndex}`}
                    />
                  );
                }

                const dateKey = toInputDate(day.date);
                const { dayReservations, dayBlocks, isB2B, hasTasks, hasConflict } = getCalendarDayData(
                  day.date,
                  homeFilter
                );

                const visibleReservations = dayReservations.filter((reservation: any) => {
                  if (reservation.type !== "Mirror Block") return true;

                  const oppositeSource = reservation.source === "VRBO" ? "Airbnb" : "VRBO";

                  const hasRealReservationProtection = dayReservations.some(
                    (otherReservation: any) =>
                      otherReservation.id !== reservation.id &&
                      otherReservation.homeId === reservation.homeId &&
                      otherReservation.source === oppositeSource &&
                      otherReservation.type === "Reservation"
                  );

                  if (hasRealReservationProtection) return false;

                  const hasOppositeMirrorBlock = dayReservations.some(
                    (otherReservation: any) =>
                      otherReservation.id !== reservation.id &&
                      otherReservation.homeId === reservation.homeId &&
                      otherReservation.source === oppositeSource &&
                      otherReservation.type === "Mirror Block"
                  );

                  if (hasOppositeMirrorBlock) return reservation.source === "VRBO";

                  return true;
                });

                const visibleReservationEvents = visibleReservations.slice(0, compact ? 2 : 4);
                const visibleBlockEvents = dayBlocks.slice(
                  0,
                  Math.max(0, (compact ? 3 : 5) - visibleReservationEvents.length)
                );

                const hiddenEventCount = Math.max(
                  0,
                  visibleReservations.length +
                    dayBlocks.length -
                    visibleReservationEvents.length -
                    visibleBlockEvents.length
                );

                return (
                  <div
                    className={`stackedCalendarDay ${day.inMonth ? "" : "mutedDay"}`}
                    key={`stacked-${dateKey}`}
                    onClick={() => {
                      setSelectedCalendarDateKey(dateKey);
                      setSelectedCalendarItem(null);
                    }}
                  >
                    <div className="dayTop">
                      <span>{day.date.getDate()}</span>
                      <div className="dayBadges">
                        {isB2B && <strong className="b2bBadge">B2B</strong>}
                        {hasTasks && <strong className="conflictBadge">Task</strong>}
                        {hasConflict && <strong className="conflictBadge">Conflict</strong>}
                      </div>
                    </div>

                    <div className="dayEvents">
                      {visibleReservationEvents.map((reservation: any) => {
                       console.log(reservation.source, reservation);
                       const home = homes.find((item: any) => item.id === reservation.homeId);
                        const cleaner = cleaners.find((item: any) => item.id === reservation.cleanerId);

                        return (
                          <button
                            type="button"
                            key={`${dateKey}-${reservation.id}`}
                            className={`calendarEvent stackedCalendarEvent source${reservation.source.replace(
                              /\s/g,
                              ""
                            )} ${needsCleanerAssignment(reservation) ? "needsCleanerEvent" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedCalendarDateKey(dateKey);
                              openReservationFromCalendar(reservation);
                            }}
                            title={`${getReservationDisplayTitle(reservation)} · ${home?.name ?? ""}`}
                          >
                            <span>
                              {home?.shortName
                                ? `${home.shortName} · ${getReservationDisplayTitle(reservation)}`
                                : getReservationDisplayTitle(reservation)}
                            </span>
                            <small>{cleaner?.name ?? getReservationDetailLabel(reservation)}</small>
                          </button>
                        );
                      })}

                      {visibleBlockEvents.map((block: any) => (
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

                      {hiddenEventCount > 0 && <p className="moreEvents">+{hiddenEventCount} more</p>}
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
