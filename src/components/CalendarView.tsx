import type { CleaningItem } from "../types";

type CalendarViewProps = {
  cleanings: CleaningItem[];
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

function getStatusColor(status: string) {
  switch (status) {
    case "Ready":
      return "#16a34a";

    case "Attention Needed":
      return "#dc2626";

    case "Cleaning":
      return "#2563eb";

    case "On The Way":
      return "#7c3aed";

    case "Accepted":
      return "#ea580c";

    default:
      return "#6b7280";
  }
}

export default function CalendarView({
  cleanings,
  updateStatus,
}: CalendarViewProps) {
  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Calendar</h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6b7280",
            }}
          >
            Upcoming reservations + cleaning schedule
          </p>
        </div>

        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            padding: "10px 14px",
            borderRadius: "12px",
            fontWeight: 600,
            color: "#1d4ed8",
          }}
        >
          {cleanings.length} Upcoming Cleanings
        </div>
      </div>

      <section className="card">
        {cleanings.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            No upcoming cleanings scheduled.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {cleanings.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "18px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "16px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: "0 0 6px",
                        fontSize: "20px",
                      }}
                    >
                      {item.property}
                    </h2>

                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      {item.departure}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "999px",
                      fontWeight: 700,
                      fontSize: "13px",
                      background: "#f3f4f6",
                      color: getStatusColor(item.status),
                    }}
                  >
                    {item.status}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <strong>Cleaner</strong>

                    <div>{item.cleaner}</div>
                  </div>

                  <div>
                    <strong>Guest</strong>

                    <div>{item.guestName}</div>
                  </div>

                  <div>
                    <strong>Checkout</strong>

                    <div>{item.departure}</div>
                  </div>

                  <div>
                    <strong>Next Check-In</strong>

                    <div>{item.arrival}</div>
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
                    className="secondary"
                    onClick={() =>
                      updateStatus(item.id, "Accepted")
                    }
                  >
                    Accept
                  </button>

                  <button
                    className="secondary"
                    onClick={() =>
                      updateStatus(item.id, "On The Way")
                    }
                  >
                    On The Way
                  </button>

                  <button
                    className="secondary"
                    onClick={() =>
                      updateStatus(item.id, "Cleaning")
                    }
                  >
                    Cleaning
                  </button>

                  <button
                    className="primary"
                    onClick={() =>
                      updateStatus(item.id, "Ready")
                    }
                  >
                    Ready
                  </button>

                  <button
                    className="danger"
                    onClick={() =>
                      updateStatus(
                        item.id,
                        "Attention Needed"
                      )
                    }
                  >
                    Attention Needed
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}