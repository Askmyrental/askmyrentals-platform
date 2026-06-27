type Home = any;
type Reservation = any;
type WorkOrder = any;
type Cleaner = any;

type GuestReadyPageProps = {
  reservations: Reservation[];
  homes: Home[];
  cleaners: Cleaner[];
  workOrders: WorkOrder[];
  selectedPropertyId: string;
  formatDate: (dateString: string) => string;
  needsCleanerAssignment: (reservation: Reservation) => boolean;
};

export default function GuestReadyPage({
  reservations,
  homes,
  cleaners,
  workOrders,
  selectedPropertyId,
  formatDate,
  needsCleanerAssignment,
}: GuestReadyPageProps) {
  const today = new Date().toISOString().slice(0, 10);

  const selectedHome = homes.find((home) => home.id === selectedPropertyId);

  const nextArrival = reservations
    .filter((reservation) => {
      const reservationPropertyId =
        reservation.homeId ?? reservation.propertyId ?? reservation.property_id;

      return (
        reservationPropertyId === selectedPropertyId &&
        reservation.arrival >= today &&
        reservation.status !== "Completed"
      );
    })
    .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];

  const cleanerId = nextArrival?.cleanerId ?? nextArrival?.cleaner_id;
  const assignedCleaner = cleaners.find((cleaner) => cleaner.id === cleanerId);

  const propertyWorkOrders = workOrders.filter((order) => {
    const orderPropertyId = order.homeId ?? order.propertyId ?? order.property_id;

    return (
      orderPropertyId === selectedPropertyId &&
      order.status !== "Completed" &&
      order.status !== "Archived"
    );
  });

  const cleanerAssigned = nextArrival ? !needsCleanerAssignment(nextArrival) : false;
  const cleanerAccepted =
    nextArrival?.cleanerStatus === "Accepted" ||
    nextArrival?.cleaner_status === "Accepted" ||
    nextArrival?.cleaningStatus === "Accepted" ||
    nextArrival?.cleaning_status === "Accepted";

  const noOpenMaintenance = propertyWorkOrders.length === 0;
  const hasProperty = Boolean(selectedHome);
  const hasNextArrival = Boolean(nextArrival);

  const checks = [
    { label: "Next arrival found", passed: hasNextArrival },
    { label: "Cleaner assigned", passed: cleanerAssigned },
    { label: "Cleaner accepted", passed: cleanerAccepted },
    { label: "No open maintenance", passed: noOpenMaintenance },
    { label: "Property selected", passed: hasProperty },
  ];

  const passedChecks = checks.filter((check) => check.passed).length;
  const guestReadyScore = Math.round((passedChecks / checks.length) * 100);

  const scoreLabel =
    guestReadyScore >= 90 ? "Guest Ready" : guestReadyScore >= 70 ? "Needs Review" : "Action Needed";

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Next Guest Ready</p>
          <h2>Guest Ready</h2>
          <p className="headerSubtext">
            Confirm the next arrival has cleaning, maintenance, and property readiness covered.
          </p>
        </div>
      </header>

      <section className="guestReadyHero">
        <div>
          <p className="eyebrow">Readiness Score</p>
          <strong>{guestReadyScore}%</strong>
          <span>{scoreLabel}</span>
        </div>

        <div>
          <h3>{selectedHome?.name ?? "No property selected"}</h3>
          {nextArrival ? (
            <p>
              Next arrival: <strong>{formatDate(nextArrival.arrival)}</strong>
            </p>
          ) : (
            <p>No upcoming arrival found for this property.</p>
          )}
        </div>
      </section>

      {nextArrival && (
        <section className="guestReadyPanel">
          <div className="panelHeader compact">
            <div>
              <p className="eyebrow">Next Arrival</p>
              <h3>{selectedHome?.name ?? "Property"}</h3>
              <p className="mutedText">
                Guest: {nextArrival.guestName ?? nextArrival.guest_name ?? nextArrival.title ?? "Guest"}
              </p>
            </div>
          </div>

          <div className="guestReadyInfoGrid">
            <div>
              <span>Arrival</span>
              <strong>{formatDate(nextArrival.arrival)}</strong>
            </div>

            <div>
              <span>Departure</span>
              <strong>{formatDate(nextArrival.departure)}</strong>
            </div>

            <div>
              <span>Cleaner</span>
              <strong>{assignedCleaner?.name ?? "Unassigned"}</strong>
            </div>

            <div>
              <span>Maintenance</span>
              <strong>{propertyWorkOrders.length} Open</strong>
            </div>
          </div>
        </section>
      )}

      <section className="guestReadyPanel">
        <div className="panelHeader compact">
          <div>
            <p className="eyebrow">Readiness Checklist</p>
            <h3>Arrival Requirements</h3>
          </div>
        </div>

        <div className="guestReadyChecklist">
          {checks.map((check) => (
            <div className={check.passed ? "readyCheck passed" : "readyCheck failed"} key={check.label}>
              <span>{check.passed ? "✓" : "!"}</span>
              <strong>{check.label}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}