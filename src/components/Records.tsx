import type { ActivityRecord } from "../types";

type RecordsProps = {
  records: ActivityRecord[];
};

export default function Records({ records }: RecordsProps) {
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
          <h1 style={{ margin: 0 }}>Activity Records</h1>
          <p
            style={{
              margin: "6px 0 0",
              color: "#6b7280",
            }}
          >
            Full homeowner + cleaner activity history
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
          {records.length} Total Events
        </div>
      </div>

      <section className="card">
        {records.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            No activity records yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {records
              .slice()
              .reverse()
              .map((record) => (
                <div
                  key={record.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                    padding: "16px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <strong>{record.event}</strong>

                    <span
                      style={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background:
                          record.source === "Cleaner"
                            ? "#ecfeff"
                            : record.source === "Homeowner"
                            ? "#eff6ff"
                            : "#f3f4f6",
                        color:
                          record.source === "Cleaner"
                            ? "#0f766e"
                            : record.source === "Homeowner"
                            ? "#1d4ed8"
                            : "#374151",
                        fontWeight: 600,
                      }}
                    >
                      {record.source}
                    </span>
                  </div>

                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "14px",
                    }}
                  >
                    {record.createdAt || record.time}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}