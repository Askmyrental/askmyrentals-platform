type Reservation = {
  cleanerId?: string;
  status: string;
  source: string;
  notes?: string;
};

type Cleaner = {
  id: string;
  name: string;
  status: string;
};

type PropertyReadinessCardProps = {
  reservation: Reservation;
  cleaner?: Cleaner;
};

function getReadinessScore(reservation: Reservation) {
  let score = 52;

  if (reservation.cleanerId) score += 18;
  if (reservation.status === "Assigned" || reservation.status === "Accepted") score += 8;
  if (reservation.status === "In Process") score += 18;
  if (reservation.status === "Completed") score += 35;
  if (reservation.notes?.trim()) score += 6;
  if (reservation.status === "Unassigned") score -= 18;
  if (reservation.status === "Blocked" || reservation.status === "No Clean Needed") score = 92;

  return Math.max(0, Math.min(100, score));
}

function getScoreLabel(score: number) {
  if (score >= 90) return "Guest Ready";
  if (score >= 75) return "On Track";
  if (score >= 55) return "Needs Review";
  return "Needs Attention";
}

export default function PropertyReadinessCard({
  reservation,
  cleaner,
}: PropertyReadinessCardProps) {
  const score = getReadinessScore(reservation);
  const label = getScoreLabel(score);

  const checks = [
    {
      label: "Cleaner Assigned",
      passed: Boolean(cleaner || reservation.cleanerId),
      detail: cleaner?.name ?? "No cleaner assigned",
    },
    {
      label: "Cleaning Status",
      passed: ["Accepted", "In Process", "Completed", "No Clean Needed", "Blocked"].includes(reservation.status),
      detail: reservation.status,
    },
    {
      label: "Operations Notes",
      passed: Boolean(reservation.notes?.trim()),
      detail: reservation.notes?.trim() ? "Notes added" : "No notes yet",
    },
    {
      label: "Calendar Health",
      passed: true,
      detail: "No linked issue shown",
    },
  ];

  return (
    <article className="reservationWorkspaceCard propertyReadinessCard">
      <div className="operationsCardHeader">
        <div>
          <p className="eyebrow">Property Readiness</p>
          <h3>{label}</h3>
        </div>
        <div className={`readinessScore score${score >= 75 ? "Good" : score >= 55 ? "Watch" : "Bad"}`}>
          {score}%
        </div>
      </div>

      <div className="readinessChecklist">
        {checks.map((check) => (
          <div className={`readyCheck ${check.passed ? "passed" : "failed"}`} key={check.label}>
            <span>{check.passed ? "✓" : "!"}</span>
            <div>
              <strong>{check.label}</strong>
              <small>{check.detail}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
