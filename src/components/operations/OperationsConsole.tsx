type OperationsConsoleProps = {
  operationsScore: number;
  missingCalendarProtection: number;
  cleanerAssignmentsNeeded: number;
  cleanerAcceptancesPending: number;
  openMaintenance: number;
  guestReadyCount: number;
  nextArrivalCount: number;
  onOpenCalendarHealth: () => void;
  onAssignCleaners: () => void;
  onSendReminders: () => void;
  onOpenMaintenance: () => void;
  onOpenGuestReady: () => void;
};

function getOperationsStatus(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Needs Attention";
  return "Critical";
}

function getOperationsClass(score: number) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

export default function OperationsConsole({
  operationsScore,
  missingCalendarProtection,
  cleanerAssignmentsNeeded,
  cleanerAcceptancesPending,
  openMaintenance,
 
 
  onOpenCalendarHealth,
  onAssignCleaners,
  onSendReminders,
  onOpenMaintenance,
 
}: OperationsConsoleProps) {
  const status = getOperationsStatus(operationsScore);
  const statusClass = getOperationsClass(operationsScore);

  const rows = [
    {
      icon: "🛡️",
      title: "Calendar Protection",
      value: missingCalendarProtection,
      goodText: "All reservations protected.",
      issueText: `${missingCalendarProtection} reservation${missingCalendarProtection === 1 ? "" : "s"} need protection.`,
      action: missingCalendarProtection === 0 ? "View Calendar" : "Protect Now",
      onClick: onOpenCalendarHealth,
      tone: missingCalendarProtection === 0 ? "good" : "danger",
    },
    {
      icon: "🧹",
      title: "Cleaner Assignment",
      value: cleanerAssignmentsNeeded,
      goodText: "All upcoming cleans are assigned.",
      issueText: `${cleanerAssignmentsNeeded} reservation${cleanerAssignmentsNeeded === 1 ? "" : "s"} need cleaner assignment.`,
      action: cleanerAssignmentsNeeded === 0 ? "View Assignments" : "Assign Cleaners",
      onClick: onAssignCleaners,
      tone: cleanerAssignmentsNeeded === 0 ? "good" : "danger",
    },
    {
      icon: "👍",
      title: "Cleaner Acceptance",
      value: cleanerAcceptancesPending,
      goodText: "All assigned cleaners have accepted.",
      issueText: `${cleanerAcceptancesPending} cleaner${cleanerAcceptancesPending === 1 ? "" : "s"} awaiting acceptance.`,
      action: cleanerAcceptancesPending === 0 ? "View Cleans" : "Send Reminders",
      onClick: onSendReminders,
      tone: cleanerAcceptancesPending === 0 ? "good" : "warning",
    },
    {
      icon: "🔧",
      title: "Maintenance",
      value: openMaintenance,
      goodText: "No maintenance issues need review.",
      issueText: `${openMaintenance} work order${openMaintenance === 1 ? "" : "s"} need review.`,
      action: openMaintenance === 0 ? "View Maintenance" : "Review",
      onClick: onOpenMaintenance,
      tone: openMaintenance === 0 ? "good" : "warning",
    },
  ];

  return (
    <section className={`operationsConsoleV2 ${statusClass}`}>
      <div className="operationsMeterRail" aria-label={`Operations ${status}, ${operationsScore}%`}>
        <span>HIGH</span>
        <div className="operationsThermometer">
          <div
            className="operationsThermometerPointer"
            style={{ bottom: `${Math.max(6, Math.min(94, operationsScore))}%` }}
          />
        </div>
        <span>LOW</span>
      </div>

      <div className="operationsConsoleBody">
        <div className="operationsConsoleHeader">
          <div>
            <p className="eyebrow">Operations</p>
            <h2>{status}</h2>
            <p className="operationsSummary">
  {operationsScore >= 90
    ? "Everything is ready for your upcoming guests."
    : operationsScore >= 75
      ? "A few operational items need attention."
      : operationsScore >= 50
        ? "Several items need attention before upcoming arrivals."
        : "Immediate action is recommended before your next arrival."}
</p>
          </div>
        </div>

        <div className="operationsRows">
          {rows.map((row) => (
            <article
  className={`operationsRow ${row.tone}`}
  key={row.title}
  onClick={row.onClick}
  role="button"
  tabIndex={0}
>
              <div className="operationsRowIcon">{row.icon}</div>

              <div className="operationsRowText">
                <h3>{row.title}</h3>
                <p>{row.value === 0 ? row.goodText : row.issueText}</p>
              </div>

             
             <button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    row.onClick();
  }}
>
  {row.action} <span>→</span>
</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
