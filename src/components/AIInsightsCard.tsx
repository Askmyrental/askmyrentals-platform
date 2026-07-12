type Reservation = {
  guestName: string;
  cleanerId?: string;
  status: string;
  source: string;
  arrival: string;
};

type Cleaner = {
  id: string;
  name: string;
};

type AIInsightsCardProps = {
  reservation: Reservation;
  cleaner?: Cleaner;
  formatDate: (date: string) => string;
};

function getRecommendation(reservation: Reservation, cleaner?: Cleaner) {
  if (reservation.status === "Unassigned" || !reservation.cleanerId) {
    return "Assign a cleaner before this stay becomes operationally risky.";
  }

  if (reservation.status === "Assigned") {
    return `${cleaner?.name ?? "The cleaner"} is assigned. Watch for cleaner acceptance before arrival.`;
  }

  if (reservation.status === "In Process") {
    return "Cleaning is in process. Confirm inspection and invoice before marking guest ready.";
  }

  if (reservation.status === "Completed") {
    return "This stay looks guest ready. No immediate action needed.";
  }

  return "Review this stay for cleaner assignment, property readiness, weather, and open maintenance.";
}

export default function AIInsightsCard({
  reservation,
  cleaner,
  formatDate,
}: AIInsightsCardProps) {
  return (
    <article className="reservationWorkspaceCard aiInsightsCard">
      <p className="eyebrow">AI Recommendation</p>
      <h3>Operations Summary</h3>

      <div className="aiSummaryBox">
        <strong>{reservation.guestName || reservation.source}</strong>
        <p>{getRecommendation(reservation, cleaner)}</p>
      </div>

      <div className="aiSignalGrid">
        <div>
          <span>Arrival</span>
          <strong>{formatDate(reservation.arrival)}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{reservation.status}</strong>
        </div>
        <div>
          <span>Cleaner</span>
          <strong>{cleaner?.name ?? "Unassigned"}</strong>
        </div>
      </div>
    </article>
  );
}
