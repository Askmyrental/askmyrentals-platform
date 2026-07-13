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
  onCalendarCreate?: (payload: { source: string; date: string; homeId: string }) => void;
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
  onCalendarCreate,
}: CalendarPageProps) {
  const activePropertyId = String(selectedPropertyId || homes[0]?.id || "");
  const dateKey = (value: unknown) => String(value ?? "").slice(0, 10);
  const activePropertyName =
    homes.find((home) => String(home.id) === activePropertyId)?.name ??
    homes[0]?.name ??
    "No Property Selected";

  const selectedDateReservations = selectedCalendarDateKey
    ? reservations
        .filter(
          (reservation) =>
            String(reservation.homeId) === activePropertyId &&
            dateKey(selectedCalendarDateKey) >= dateKey(reservation.arrival) &&
            dateKey(selectedCalendarDateKey) < dateKey(reservation.departure)
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
          String(block.homeId) === activePropertyId &&
          dateKey(selectedCalendarDateKey) >= dateKey(block.start) &&
          dateKey(selectedCalendarDateKey) < dateKey(block.end)
      )
    : [];

  const selectedItemCount = selectedDateReservations.length + selectedDateBlocks.length;
  const shouldShowEmptyDaySheet = Boolean(selectedCalendarDateKey) && selectedItemCount === 0;

  function openCreateReservation() {
    if (!selectedCalendarDateKey) return;

    setSelectedCalendarItem(null);
    setReservationDetailReturnPage("Calendar");
    onCalendarCreate?.({
      source: "Guest Reservation",
      date: selectedCalendarDateKey,
      homeId: activePropertyId,
    });
    setActivePage("Reservations");
  }

  function openCreateOwnerBlock() {
    if (!selectedCalendarDateKey) return;

    setSelectedCalendarItem(null);
    setReservationDetailReturnPage("Calendar");
    onCalendarCreate?.({
      source: "Owner Block",
      date: selectedCalendarDateKey,
      homeId: activePropertyId,
    });
    setActivePage("Reservations");
  }


  return (
    <>
      <section className="calendarMobileControls calendarStickyControls">
        <div className="calendarControlTop">
          <div>
            <p className="eyebrow">Operations Calendar</p>
            <h2>Calendar</h2>
          </div>

          <button className="ghostButton compactMonthButton" onClick={() => setCalendarDate(new Date())}>
            Today
          </button>
        </div>

        <label>
          Property
          <div className="readOnlyPropertyField">{activePropertyName}</div>
        </label>

       <div className="calendarLegend calendarLegendSticky">
  <span className="legendItem">
    <span className="legendDot needsCleanerDot" />
    Needs Cleaner
  </span>

  <span className="legendItem">
    <span className="legendDot assignedDot" />
    Assigned
  </span>

  <span className="legendItem">
    <span className="legendDot acceptedDot" />
    Accepted
  </span>

  <span className="legendItem">
    <span className="legendDot inProcessDot" />
    In Process
  </span>

  <span className="legendItem">
    <span className="legendDot completedDot" />
    Completed
  </span>

  <span className="legendItem">
    <span className="legendDot ownerBlockDot" />
    Owner Block
  </span>
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
                {selectedItemCount} calendar item{selectedItemCount === 1 ? "" : "s"} on this date.
              </p>

              {selectedItemCount === 0 && (
                <div className="calendarEmptyDayActions desktopCalendarEmptyActions">
                  <p className="mutedText">No reservations or tasks on this date.</p>

                  <div className="cardActions">
                    <button className="primaryButton" type="button" onClick={openCreateReservation}>
                      Create Guest Reservation
                    </button>

                    <button className="ghostButton" type="button" onClick={openCreateOwnerBlock}>
                      Create Owner Block
                    </button>
                  </div>
                </div>
              )}

              <div className="dashboardReservationCards">
                {selectedDateReservations.map((reservation) => {
                  const home = homes.find(
                    (item) => String(item.id) === String(reservation.homeId)
                  );
                  const cleaner = cleaners.find(
                    (item) => String(item.id) === String(reservation.cleanerId)
                  );
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
                    <p>{homes.find((home) => String(home.id) === String(block.homeId))?.name ?? "Unknown property"}</p>

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
                  ? homes.find((home) => String(home.id) === String(selectedCalendarItem.homeId))?.name
                  : selectedCalendarItem.type}
              </p>
            </>
          ) : (
            <>
              <h3>Tap a calendar date</h3>
              <p className="mutedText">Reservations and operations for that day will show here together.</p>
            </>
          )}
        </aside>
      </section>

      {shouldShowEmptyDaySheet && (
        <div className="calendarActionSheetOverlay" onClick={() => setSelectedCalendarItem(null)}>
          <section className="calendarActionSheet" onClick={(event) => event.stopPropagation()}>
            <div className="calendarActionSheetHandle" />

            <div className="calendarActionSheetHeader">
              <p className="eyebrow">Create from calendar</p>
              <h3>{formatDate(selectedCalendarDateKey as string)}</h3>
              <p className="mutedText">Choose what you want to add for {activePropertyName}.</p>
            </div>

            <div className="calendarActionSheetGrid">
              <button type="button" onClick={openCreateReservation}>
                <span>➕</span>
                <strong>Guest Reservation</strong>
                <small>Create a manual guest booking.</small>
              </button>

              <button type="button" onClick={openCreateOwnerBlock}>
                <span>🚫</span>
                <strong>Owner Block</strong>
                <small>Block dates for owner use or downtime.</small>
              </button>

            </div>

            <button
              className="calendarActionSheetCancel"
              type="button"
              onClick={() => setSelectedCalendarItem(null)}
            >
              Cancel
            </button>
          </section>
        </div>
      )}
    </>
  );
}
