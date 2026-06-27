type CalendarPageProps = {
  reservations: any[];
  calendarBlocks: any[];
  homes: any[];
  cleaners: any[];
  selectedPropertyId: string;
  calendarDate: Date;
  setCalendarDate: (value: Date) => void;
  selectedCalendarDateKey: string | null;
  selectedCalendarItem: any;
  setSelectedCalendarItem: (value: any) => void;
  setReservationDetailReturnPage: (value: string) => void;
  setActivePage: (value: string) => void;
  renderScrollableCalendarStack: (options: {
    homeFilter: string;
    anchorDate: Date;
    monthCount: number;
    compact: boolean;
  }) => React.ReactNode;
  formatDate: (value: string) => string;
  isTaskSource: (source: any) => boolean;
  getReservationDisplayTitle: (reservation: any) => string;
};

export function CalendarPage({
  reservations,
  calendarBlocks,
  homes,
  cleaners,
  selectedPropertyId,
  calendarDate,
  setCalendarDate,
  selectedCalendarDateKey,
  selectedCalendarItem,
  setSelectedCalendarItem,
  setReservationDetailReturnPage,
  setActivePage,
  renderScrollableCalendarStack,
  formatDate,
  isTaskSource,
  getReservationDisplayTitle,
}: CalendarPageProps) {
  const activePropertyId = selectedPropertyId || homes[0]?.id || "";
  const activePropertyName =
    homes.find((home) => home.id === activePropertyId)?.name ??
    homes[0]?.name ??
    "No Property Selected";

  const selectedDateReservations = selectedCalendarDateKey
    ? reservations
        .filter(
          (reservation) =>
            reservation.homeId === activePropertyId &&
            selectedCalendarDateKey >= reservation.arrival &&
            selectedCalendarDateKey < reservation.departure
        )
        .sort((a, b) => {
          if (isTaskSource(a.source) && !isTaskSource(b.source)) return 1;
          if (!isTaskSource(a.source) && isTaskSource(b.source)) return -1;
          return a.arrival.localeCompare(b.arrival);
        })
    : [];

  const selectedDateBlocks = selectedCalendarDateKey
    ? calendarBlocks.filter(
        (block) =>
          block.homeId === activePropertyId &&
          selectedCalendarDateKey >= block.start &&
          selectedCalendarDateKey < block.end
      )
    : [];

  return (
    <>
      <section className="calendarMobileControls">
        <h2>Calendar</h2>

        <label>
          Property
          <div className="readOnlyPropertyField">{activePropertyName}</div>
        </label>

        <button className="ghostButton" onClick={() => setCalendarDate(new Date())}>
          Jump to Current Month
        </button>

        <div className="calendarLegend">
          <span><i className="legendDot sourceVRBO" /> VRBO</span>
          <span><i className="legendDot sourceAirbnb" /> Airbnb</span>
          <span><i className="legendDot sourceGuestReservation" /> Guest Reservation</span>
          <span><i className="legendDot sourceOwnerBlock" /> Owner Block</span>
          <span><i className="legendDot needsCleaner" /> Needs Cleaner</span>
          <span><i className="legendDot conflict" /> Conflict</span>
        </div>
      </section>

      <section className="calendarLayout">
        <div className="calendarPanel stackedCalendarPanel">
          <div className="taskBoardCalendarBox calendarPageCalendarBox">
            {renderScrollableCalendarStack({
              homeFilter: activePropertyId,
              anchorDate: calendarDate,
              monthCount: 12,
              compact: true,
            })}
          </div>
        </div>

        <aside
          className={`calendarDetailPanel ${
            !selectedCalendarDateKey && !selectedCalendarItem ? "emptyCalendarDetailPanel" : ""
          }`}
          id="calendarDetailPanel"
        >
          <p className="eyebrow">Selected date</p>

          {selectedCalendarDateKey ? (
            <>
              <h3>{formatDate(selectedCalendarDateKey)}</h3>
              <p className="mutedText">
                {selectedDateReservations.length + selectedDateBlocks.length} calendar item
                {selectedDateReservations.length + selectedDateBlocks.length === 1 ? "" : "s"} on this date.
              </p>

              <div className="dashboardReservationCards">
                {selectedDateReservations.map((reservation) => {
                  const home = homes.find((item) => item.id === reservation.homeId);
                  const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);
                  const isTask = isTaskSource(reservation.source);

                  return (
                    <button
                      key={`calendar-detail-${reservation.id}`}
                      type="button"
                      className="dashboardReservationCard"
                      onClick={() => {
                        setSelectedCalendarItem(reservation);
                        setReservationDetailReturnPage("Calendar");
                        setActivePage("Reservation Detail");
                      }}
                    >
                      <span className={`platformBadge platform${reservation.source.replace(/\s/g, "")}`}>
                        {isTask ? "TASK" : reservation.source.toUpperCase()}
                      </span>
                      <h3>{isTask ? getReservationDisplayTitle(reservation) : reservation.guestName}</h3>
                      <p>{home?.name ?? "Unknown property"}</p>

                      <div className="reservationPreviewMeta">
                        <div>
                          <span>{isTask ? "Task Date" : "Arrival"}</span>
                          <strong>{formatDate(reservation.arrival)}</strong>
                        </div>
                        <div>
                          <span>{isTask ? "Type" : "Departure"}</span>
                          <strong>{isTask ? reservation.source : formatDate(reservation.departure)}</strong>
                        </div>
                      </div>

                      <div className="assignedCleanerLine">
                        <span>{isTask ? "Status" : "Cleaner"}</span>
                        <strong>{isTask ? reservation.status : cleaner?.name ?? "Unassigned"}</strong>
                      </div>
                    </button>
                  );
                })}

                {selectedDateBlocks.map((block) => (
                  <button
                    key={`calendar-detail-${block.id}`}
                    type="button"
                    className="dashboardReservationCard"
                    onClick={() => setSelectedCalendarItem(block)}
                  >
                    <span className="platformBadge">BLOCK</span>
                    <h3>{block.title}</h3>
                    <p>{homes.find((home) => home.id === block.homeId)?.name ?? "Unknown property"}</p>

                    <div className="reservationPreviewMeta">
                      <div>
                        <span>Start</span>
                        <strong>{formatDate(block.start)}</strong>
                      </div>
                      <div>
                        <span>End</span>
                        <strong>{formatDate(block.end)}</strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedDateReservations.length + selectedDateBlocks.length === 0 && (
                <p className="mutedText">No reservations or tasks on this date.</p>
              )}
            </>
          ) : selectedCalendarItem ? (
            <>
              <h3>
                {"guestName" in selectedCalendarItem
                  ? selectedCalendarItem.guestName
                  : selectedCalendarItem.title}
              </h3>

              <p className="mutedText">
                {"guestName" in selectedCalendarItem
                  ? homes.find((home) => home.id === selectedCalendarItem.homeId)?.name
                  : selectedCalendarItem.type}
              </p>
            </>
          ) : (
            <>
              <h3>Click a calendar date</h3>
              <p className="mutedText">Reservations and operations for that day will show here together.</p>
            </>
          )}
        </aside>
      </section>
    </>
  );
}
