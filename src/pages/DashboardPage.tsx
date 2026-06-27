type Cleaner = any;
type Home = any;
type Reservation = any;
type WorkOrder = any;

type DashboardPageProps = {
  reservations: Reservation[];
  homes: Home[];
  cleaners: Cleaner[];
  workOrders: WorkOrder[];
  selectedPropertyId: string;
  setActivePage: (page: string) => void;
  setSelectedCalendarItem: (item: Reservation) => void;
  setSelectedItemType: (type: string) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedHome: (homeId: string) => void;
  setSearch: (search: string) => void;
  isImportedReservation: (reservation: Reservation) => boolean;
  isTaskSource: (source: Reservation["source"]) => boolean;
  needsCleanerAssignment: (reservation: Reservation) => boolean;
  formatDate: (dateString: string) => string;
};

export default function DashboardPage({
  reservations,
  homes,
  cleaners,
  workOrders,
  selectedPropertyId,
  setActivePage,
  setSelectedCalendarItem,
  setSelectedItemType,
  setSelectedStatus,
  setSelectedHome,
  setSearch,
  isImportedReservation,
  isTaskSource,
  needsCleanerAssignment,
  formatDate,
}: DashboardPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const selectedProperty = homes.find((home) => home.id === selectedPropertyId);

  const getReservationPropertyId = (reservation: Reservation) =>
    reservation.homeId ?? reservation.propertyId ?? reservation.property_id;

  const getReservationCleanerId = (reservation: Reservation) =>
    reservation.cleanerId ?? reservation.cleaner_id;

  const getReservationHome = (reservation: Reservation) =>
    homes.find((home) => home.id === getReservationPropertyId(reservation));

  const getReservationCleaner = (reservation: Reservation) =>
    cleaners.find((cleaner) => cleaner.id === getReservationCleanerId(reservation));

  const isSelectedPropertyReservation = (reservation: Reservation) =>
    !selectedPropertyId ||
    selectedPropertyId === "all" ||
    getReservationPropertyId(reservation) === selectedPropertyId;

  const isActiveReservation = (reservation: Reservation) =>
    reservation.status !== "Completed" && reservation.departure >= today;

  const importedFutureReservations = reservations.filter(
    (reservation) =>
      isImportedReservation(reservation) &&
      isSelectedPropertyReservation(reservation) &&
      isActiveReservation(reservation)
  );

  const upcomingReservations = [...importedFutureReservations]
    .sort((a, b) => String(a.arrival).localeCompare(String(b.arrival)))
    .slice(0, 3);

  const reservationItems = reservations.filter(
    (item) =>
      (isImportedReservation(item) || item.source === "Owner Block") &&
      isSelectedPropertyReservation(item) &&
      item.departure >= today
  );

  const arrivalsToday = importedFutureReservations.filter(
    (reservation) => reservation.arrival === today
  ).length;

  const departuresToday = importedFutureReservations.filter(
    (reservation) => reservation.departure === today
  ).length;

  const cleansToday = reservationItems.filter((reservation) => reservation.departure === today).length;

  const reservationsNeedingCleanerAssigned = reservationItems.filter((item) =>
    needsCleanerAssignment(item)
  ).length;

  const assignedReservations = reservationItems.filter((reservation) =>
    Boolean(getReservationCleanerId(reservation))
  );

  const awaitingCleanerAcceptance = assignedReservations.filter((reservation) => {
    const status = String(
      reservation.cleanerStatus ??
        reservation.cleaner_status ??
        reservation.cleanStatus ??
        reservation.clean_status ??
        ""
    ).toLowerCase();

    return status.includes("await") || status.includes("pending") || status.includes("assigned");
  }).length;

  const acceptedCleans = assignedReservations.filter((reservation) => {
    const status = String(
      reservation.cleanerStatus ??
        reservation.cleaner_status ??
        reservation.cleanStatus ??
        reservation.clean_status ??
        ""
    ).toLowerCase();

    return status.includes("accept");
  }).length;

  const openWorkOrders = workOrders.filter(
    (order) => order.status !== "Completed" && order.status !== "Archived"
  );

  const urgentWorkOrders = workOrders.filter(
    (order) => order.urgency === "High" || order.urgency === "After Hours"
  );

  const attentionCount =
    reservationsNeedingCleanerAssigned + awaitingCleanerAcceptance + urgentWorkOrders.length;

  const operationsScore = Math.max(72, 100 - attentionCount * 8 - openWorkOrders.length * 2);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";

  const briefingLine =
    attentionCount === 0
      ? "Everything looks calm. No urgent operations need attention right now."
      : `${attentionCount} operation${attentionCount === 1 ? " needs" : "s need"} attention today.`;

  function openReservationFromDashboard(reservation: Reservation) {
    setSelectedCalendarItem(reservation);
    setActivePage("Reservation Detail");
  }

  function openNeedsCleanerAssigned(event?: React.MouseEvent) {
    event?.stopPropagation();
    setSelectedItemType("needs-cleaner");
    setSelectedStatus("all");
    setSelectedHome("all");
    setSearch("");
    setActivePage("Reservations");
  }

  return (
    <>
      <header className="dashboardBriefingHero">
        <div>
          <p className="eyebrow">Ask My Rentals</p>
          <h2>{greeting}</h2>
          <p>{briefingLine}</p>
        </div>

        <div className="operationsScoreCard">
          <span>Operations Health</span>
          <strong>{operationsScore}%</strong>
          <p>{operationsScore >= 90 ? "Excellent" : operationsScore >= 80 ? "Stable" : "Needs Review"}</p>
        </div>
      </header>

      <section className="morningBriefingGrid">
        <button className="briefingMetricCard" type="button" onClick={() => setActivePage("Reservations")}>
          <span>Arrivals Today</span>
          <strong>{arrivalsToday}</strong>
          <p>Guests checking in</p>
        </button>

        <button className="briefingMetricCard" type="button" onClick={() => setActivePage("Reservations")}>
          <span>Departures Today</span>
          <strong>{departuresToday}</strong>
          <p>Turnovers to watch</p>
        </button>

        <button className="briefingMetricCard" type="button" onClick={() => setActivePage("Housekeeping")}>
          <span>Cleans Today</span>
          <strong>{cleansToday}</strong>
          <p>{reservationsNeedingCleanerAssigned} need cleaner assigned</p>
        </button>

        <button className="briefingMetricCard warning" type="button" onClick={openNeedsCleanerAssigned}>
          <span>Cleaner Alerts</span>
          <strong>{reservationsNeedingCleanerAssigned + awaitingCleanerAcceptance}</strong>
          <p>{awaitingCleanerAcceptance} awaiting acceptance</p>
        </button>
      </section>

      <section className="dashboardHeroGrid">
        <button className="dashboardLaunchCard housekeeping" type="button" onClick={() => setActivePage("Housekeeping")}>
          <span className="launchIcon">🧹</span>
          <div>
            <h3>Housekeeping</h3>
            <strong>{reservationItems.length} Upcoming Cleans</strong>
            <p>{acceptedCleans} accepted · {reservationsNeedingCleanerAssigned} unassigned</p>
          </div>
        </button>

        <button className="dashboardLaunchCard maintenance" type="button" onClick={() => setActivePage("Maintenance")}>
          <span className="launchIcon">🔧</span>
          <div>
            <h3>Maintenance</h3>
            <strong>{openWorkOrders.length} Open Issues</strong>
            <p>{urgentWorkOrders.length} urgent</p>
          </div>
        </button>

        <button className="dashboardLaunchCard properties" type="button" onClick={() => setActivePage("Guest Ready")}>.
          <span className="launchIcon">🏡</span>
          <div>
            <h3>Guest Ready</h3>
            <strong>{selectedProperty?.name ?? "No Property Selected"}</strong>
            <p>{attentionCount === 0 ? "Ready for upcoming guests" : "Review open alerts"}</p>
          </div>
        </button>

        <button className="dashboardLaunchCard" type="button" onClick={() => setActivePage("Notification Center")}>
          <span className="launchIcon">🔔</span>
          <div>
            <h3>Notifications</h3>
            <strong>{attentionCount} Open Alerts</strong>
            <p>Open Notification Center</p>
          </div>
        </button>
      </section>

      <section className="dashboardReservationsSection">
        <div className="panelHeader compact">
          <div>
            <p className="eyebrow">Next 3</p>
            <h3>Upcoming Reservations</h3>
          </div>
        </div>

        <div className="dashboardReservationCards">
          {upcomingReservations.map((reservation) => {
            const home = getReservationHome(reservation);
            const cleaner = getReservationCleaner(reservation);

            return (
              <button
                key={reservation.id}
                type="button"
                className="dashboardReservationCard"
                onClick={() => openReservationFromDashboard(reservation)}
              >
                <span className={`platformBadge platform${String(reservation.source).replace(/\s/g, "")}`}>
                  {String(reservation.source).toUpperCase()}
                </span>

                <h3>{home?.name ?? "Imported reservation"}</h3>
                <p>{reservation.guestName ?? reservation.guest_name ?? "Guest reservation"}</p>

                <div className="reservationPreviewMeta">
                  <div>
                    <span>{isTaskSource(reservation.source) ? "Task Date" : "Arrival"}</span>
                    <strong>{formatDate(reservation.arrival)}</strong>
                  </div>

                  <div>
                    <span>{isTaskSource(reservation.source) ? "Type" : "Departure"}</span>
                    <strong>{isTaskSource(reservation.source) ? reservation.source : formatDate(reservation.departure)}</strong>
                  </div>
                </div>

                <div className="assignedCleanerLine">
                  <span>Assigned Cleaner</span>
                  <strong>{cleaner?.name ?? "Unassigned"}</strong>
                </div>
              </button>
            );
          })}
        </div>

        <button
          className="primaryButton fullWidthButton"
          type="button"
          onClick={() => {
            setSelectedItemType("reservations");
            setSelectedStatus("all");
            setSearch("");
            setActivePage("Reservations");
          }}
        >
          View Imported Reservations →
        </button>
      </section>
    </>
  );
}
