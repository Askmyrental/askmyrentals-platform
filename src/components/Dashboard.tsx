import type { CleaningItem } from "../types";
import { getUrgencyForCleaning } from "../utils/urgency";

type DashboardProps = {
  sortedCleanings: CleaningItem[];
  updateStatus: (
    id: number,
    status:
      | "Assigned"
      | "Accepted"
      | "On The Way"
      | "Cleaning"
      | "Ready"
      | "Attention Needed"
  ) => void;
};

export default function Dashboard({
  sortedCleanings,
  updateStatus,
}: DashboardProps) {
  const totalTurnovers = sortedCleanings.length;

  const onTrack = sortedCleanings.filter(
    (item) =>
      item.status === "Assigned" ||
      item.status === "Accepted" ||
      item.status === "Ready"
  ).length;

  const cleanerEtaNeeded = sortedCleanings.filter(
    (item) => item.status === "Assigned"
  ).length;

  const attentionNeeded = sortedCleanings.filter(
    (item) => item.status === "Attention Needed"
  ).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <section>
        <h1
          style={{
            marginBottom: "20px",
            fontSize: "30px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Operations Dashboard
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <div className="stat-card">
            <div className="stat-number">{totalTurnovers}</div>
            <div className="stat-label">Total Turnovers</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{onTrack}</div>
            <div className="stat-label">On Track</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{cleanerEtaNeeded}</div>
            <div className="stat-label">Cleaner ETA Needed</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{attentionNeeded}</div>
            <div className="stat-label">Attention Needed</div>
          </div>
        </div>
      </section>

      <section>
        <h2
          style={{
            marginBottom: "16px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Upcoming Turnovers
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {sortedCleanings.map((item) => {
            const urgency = getUrgencyForCleaning(item);

            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "18px",
                  padding: "20px",
                  border: "1px solid #dbe4ee",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "20px",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {item.property}
                    </h3>

                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "#64748b",
                        fontSize: "14px",
                      }}
                    >
                      Guest: {item.guestName}
                    </p>
                  </div>

                  <div
                    style={{
                     background:
  urgency.label === "Urgent"
    ? "#dc2626"
    : urgency.label === "Needs Attention"
    ? "#f59e0b"
    : "#16a34a",
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: "999px",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    {urgency.label}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "14px",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <strong>Departure</strong>
                    <div>{item.departure}</div>
                  </div>

                  <div>
                    <strong>Arrival</strong>
                    <div>{item.arrival}</div>
                  </div>

                  <div>
                    <strong>Cleaner</strong>
                    <div>{item.cleaner}</div>
                  </div>

                  <div>
                    <strong>Status</strong>
                    <div>{item.status}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="primary-btn"
                    onClick={() =>
                      updateStatus(item.id, "On The Way")
                    }
                  >
                    Cleaner En Route
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() =>
                      updateStatus(item.id, "Cleaning")
                    }
                  >
                    Start Cleaning
                  </button>

                  <button
                    className="success-btn"
                    onClick={() =>
                      updateStatus(item.id, "Ready")
                    }
                  >
                    Mark Ready
                  </button>

                  <button
                    className="danger-btn"
                    onClick={() =>
                      updateStatus(item.id, "Attention Needed")
                    }
                  >
                    Flag Issue
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}