type OccupancyPageProps = {
  reservations: any[];
  calendarBlocks: any[];
  homes: any[];
  dismissedDiscrepancies: string[];
  setDismissedDiscrepancies: React.Dispatch<React.SetStateAction<string[]>>;
  setActivePage: (page: string) => void;
  isImportedReservation: (reservation: any) => boolean;
  toDate: (dateString: string) => Date;
  getTaskDayCount: (reservations: any[]) => number;
  getCalendarSyncIssues: (reservations: any[], homes: any[], dismissedIds: string[]) => any[];
};

export default function OccupancyPage({
  reservations,
  calendarBlocks,
  homes,
  setActivePage,
  toDate,
  getTaskDayCount,
}: OccupancyPageProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  yearEnd.setHours(0, 0, 0, 0);

  const totalDays =
    Math.ceil((yearEnd.getTime() - yearStart.getTime()) / 86400000) + 1;

  const getClippedNightCount = (arrival: string, departure: string) => {
    const start = toDate(arrival);
    const end = toDate(departure);

    if (end < yearStart || start > yearEnd) return 0;

    const clippedStart = start < yearStart ? yearStart : start;
    const clippedEnd = end > yearEnd ? yearEnd : end;

    return Math.max(
      0,
      Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 86400000)
    );
  };
  const guestNights = reservations
    .filter(
      (reservation) =>
        reservation.type === "Reservation" &&
        reservation.status !== "Blocked"
    )
    .reduce(
      (total, reservation) =>
        total + getClippedNightCount(reservation.arrival, reservation.departure),
      0
    );

  const blockedNights =
    reservations
      .filter(
        (reservation) =>
          reservation.type === "Mirror Block" ||
          reservation.type === "Owner Block" ||
          reservation.status === "Blocked"
      )
      .reduce(
        (total, reservation) =>
          total + getClippedNightCount(reservation.arrival, reservation.departure),
        0
      ) +
    calendarBlocks
      .filter((block) => block.type === "Maintenance")
      .reduce(
        (total, block) => total + getClippedNightCount(block.start, block.end),
        0
      );

  const taskDays = getTaskDayCount(reservations);
  const openNights = Math.max(0, totalDays - guestNights - blockedNights);
  const occupancyPercent = Math.round((guestNights / totalDays) * 100);
  const projectedOccupancy = Math.min(100, occupancyPercent + 7);

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Owner intelligence</p>
          <h2>Occupancy</h2>
          <p className="headerSubtext">
            Track guest nights, blocked nights, open inventory, AMR task days, projections, and calendar discrepancies.
          </p>
        </div>

        <button className="primaryButton" onClick={() => setActivePage("Calendar")}>
          Open Calendar
        </button>
      </header>

      <section className="occupancyStatsGrid">
        <article className="occupancyCard">
          <span>Occupancy</span>
          <strong>{occupancyPercent}%</strong>
          <p>Guest nights divided by annual inventory</p>
        </article>

        <article className="occupancyCard">
          <span>Guest Nights</span>
          <strong>{guestNights}</strong>
          <p>Booked rental nights</p>
        </article>

        <article className="occupancyCard">
          <span>Blocked Nights</span>
          <strong>{blockedNights}</strong>
          <p>Imported blocked or unavailable nights</p>
        </article>

        <article className="occupancyCard">
          <span>AMR Task Days</span>
          <strong>{taskDays}</strong>
          <p>Operational task days scheduled in Ask My Rentals.</p>
          <small className="mutedText">These do not affect guest occupancy.</small>
        </article>

        <article className="occupancyCard">
          <span>Projected Occupancy</span>
          <strong>{projectedOccupancy}%</strong>
          <p>Mock projection until historical data is connected</p>
        </article>
      </section>

      <section className="occupancyLayout">
        <aside className="occupancyPanel">
          <div className="panelHeader compact">
            <div>
              <p className="eyebrow">Reports</p>
              <h3>Occupancy Report</h3>
            </div>
          </div>

          <div className="occupancyReportFilters">
            <label>
              Property
              <div className="occupancySelectedProperty">
                {homes[0]?.name ?? "No Property Selected"}
              </div>
            </label>

            <label>
              Period
              <select defaultValue="year">
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
                <option value="prior-year">Prior year comparison</option>
              </select>
            </label>
          </div>

          <div className="occupancyReportBox">
            <div className="occupancyReportRow">
              <span>Guest nights</span>
              <strong>{guestNights}</strong>
            </div>
            <div className="occupancyReportRow">
              <span>AMR task days</span>
              <strong>{taskDays}</strong>
            </div>
            <div className="occupancyReportRow">
              <span>Blocked nights</span>
              <strong>{blockedNights}</strong>
            </div>
            <div className="occupancyReportRow">
              <span>Open nights</span>
              <strong>{openNights}</strong>
            </div>
            <div className="occupancyReportRow total">
              <span>Occupancy</span>
              <strong>{occupancyPercent}%</strong>
            </div>
          </div>

          <button className="primaryButton fullWidthButton">Generate Report</button>
          <p className="mutedText">For now this gives owners the core numbers they can manually enter into county or tax reporting portals.</p>
        </aside>
      </section>
    </>
  );
}
