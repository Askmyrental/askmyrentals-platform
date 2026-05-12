import type { CleaningItem } from "../types";

type CleanerPortalProps = {
  cleanerPortalItems: CleaningItem[];
  cleanerPortalFilter: string;
  setCleanerPortalFilter: (value: string) => void;
  cleaners: { name: string }[];
  sortedMessages: any;
  cleanerReplyText: string;
  setCleanerReplyText: (value: string) => void;
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

function getStatusStyle(status: string) {
  if (status === "Ready") {
    return { background: "#dcfce7", color: "#166534" };
  }

  if (status === "Cleaning") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }

  if (status === "On The Way") {
    return { background: "#fef3c7", color: "#92400e" };
  }

  if (status === "Accepted") {
    return { background: "#ede9fe", color: "#5b21b6" };
  }

  if (status === "Attention Needed") {
    return { background: "#fee2e2", color: "#991b1b" };
  }

  return { background: "#f1f5f9", color: "#334155" };
}

function getNextAction(status: string) {
  if (status === "Assigned") {
    return { label: "Accept Job", nextStatus: "Accepted" as const };
  }

  if (status === "Accepted") {
    return { label: "On The Way", nextStatus: "On The Way" as const };
  }

  if (status === "On The Way") {
    return { label: "Start Cleaning", nextStatus: "Cleaning" as const };
  }

  if (status === "Cleaning") {
    return { label: "Mark Ready", nextStatus: "Ready" as const };
  }

  return null;
}

export default function CleanerPortal({
  cleanerPortalItems,
  cleanerPortalFilter,
  setCleanerPortalFilter,
  cleaners,
  sortedMessages,
  setCleanerReplyText,
  updateStatus,
}: CleanerPortalProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "14px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", color: "#0f172a" }}>
              Cleaner Portal
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              Compact view of assigned turnovers and next actions.
            </p>
          </div>

          <select
            value={cleanerPortalFilter}
            onChange={(e) => setCleanerPortalFilter(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              minWidth: "200px",
            }}
          >
            <option value="All">All Cleaners</option>
            {cleaners.map((cleaner) => (
              <option key={cleaner.name} value={cleaner.name}>
                {cleaner.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {cleanerPortalItems.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "18px",
                color: "#64748b",
              }}
            >
              No assigned cleanings found.
            </div>
          ) : (
            cleanerPortalItems.map((item) => {
              const statusStyle = getStatusStyle(item.status);
              const nextAction = getNextAction(item.status);

              const itemMessages = sortedMessages.filter(
                (msg: any) =>
                  msg.property === item.property && msg.cleaner === item.cleaner
              );

              return (
                <div
                  key={item.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #dbe4ee",
                    borderRadius: "16px",
                    padding: "16px",
                    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "18px",
                          color: "#0f172a",
                        }}
                      >
                        {item.property}
                      </h2>

                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#64748b",
                          fontSize: "14px",
                        }}
                      >
                        {item.guestName} • {item.cleaner}
                      </p>
                    </div>

                    <div
                      style={{
                        ...statusStyle,
                        borderRadius: "999px",
                        padding: "7px 11px",
                        fontWeight: 800,
                        fontSize: "13px",
                      }}
                    >
                      {item.status}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: "10px",
                      marginTop: "14px",
                      fontSize: "14px",
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
                      <strong>Last Update</strong>
                      <div>{item.lastUpdate || "Not updated yet"}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      marginTop: "14px",
                    }}
                  >
                    {nextAction ? (
                      <button
                        className="primary-btn"
                        onClick={() =>
                          updateStatus(item.id, nextAction.nextStatus)
                        }
                      >
                        {nextAction.label}
                      </button>
                    ) : (
                      <button className="secondary-btn" disabled>
                        No Action Needed
                      </button>
                    )}

                    <button
                      className="danger-btn"
                      onClick={() =>
                        updateStatus(item.id, "Attention Needed")
                      }
                    >
                      Report Issue
                    </button>
                  </div>

                  {itemMessages.length > 0 && (
                    <div
                      style={{
                        marginTop: "14px",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "12px",
                      }}
                    >
                      <strong style={{ fontSize: "14px" }}>
                        Latest Message
                      </strong>

                      <p style={{ margin: "6px 0 0", color: "#475569" }}>
                        {itemMessages[0].text}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}