import type { AppMessage } from "../types";

type NotificationsProps = {
  messages: AppMessage[];
};

function getBadgeColor(category: string) {
  switch (category) {
    case "Urgent":
      return {
        background: "#fee2e2",
        color: "#b91c1c",
      };

    case "Important":
      return {
        background: "#fef3c7",
        color: "#92400e",
      };

    default:
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
      };
  }
}

export default function Notifications({
  messages,
}: NotificationsProps) {
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
          <h1 style={{ margin: 0 }}>Notification Center</h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6b7280",
            }}
          >
            Homeowner + cleaner communication feed
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
          {messages.length} Notifications
        </div>
      </div>

      <section className="card">
        {messages.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            No notifications yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {messages
              .slice()
              .reverse()
              .map((message) => {
                const badge = getBadgeColor(
                  message.category || "Normal"
                );

                return (
                  <div
                    key={message.id}
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>{message.sender}</strong>

                        <span
                          style={{
                            fontSize: "12px",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontWeight: 600,
                            background: badge.background,
                            color: badge.color,
                          }}
                        >
                          {message.category || "Normal"}
                        </span>
                      </div>

                      <span
                        style={{
                          color: "#6b7280",
                          fontSize: "13px",
                        }}
                      >
                        {message.timestamp}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "#111827",
                        lineHeight: 1.5,
                      }}
                    >
                      {message.text}
                    </div>

                    {message.property && (
                      <div
                        style={{
                          marginTop: "12px",
                          color: "#6b7280",
                          fontSize: "13px",
                        }}
                      >
                        Property: {message.property}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}