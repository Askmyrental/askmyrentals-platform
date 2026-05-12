import { useMemo } from "react";

type CleaningItem = {
  id: number;
  property: string;
  cleaner: string;
  checkOut: string;
  nextCheckIn?: string;
  status: string;
  priority?: string;
};

type Props = {
  cleanings: CleaningItem[];
  onUpdateStatus: (id: number, status: string) => void;
};

const statusColors: Record<string, string> = {
  Assigned: "#f59e0b",
  Accepted: "#3b82f6",
  "On The Way": "#8b5cf6",
  Cleaning: "#06b6d4",
  Ready: "#10b981",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <div
      style={{
        background: statusColors[status] || "#64748b",
        color: "white",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {status}
    </div>
  );
}

function CleaningCard({
  item,
  onUpdateStatus,
}: {
  item: CleaningItem;
  onUpdateStatus: (id: number, status: string) => void;
}) {
  const nextAction = () => {
    switch (item.status) {
      case "Assigned":
        return {
          label: "Accept Job",
          status: "Accepted",
        };

      case "Accepted":
        return {
          label: "On The Way",
          status: "On The Way",
        };

      case "On The Way":
        return {
          label: "Start Cleaning",
          status: "Cleaning",
        };

      case "Cleaning":
        return {
          label: "Mark Ready",
          status: "Ready",
        };

      default:
        return null;
    }
  };

  const action = nextAction();

  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: 20,
        marginBottom: 18,
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {item.property}
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Cleaner: {item.cleaner}
          </div>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            padding: 14,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginBottom: 4,
            }}
          >
            CHECKOUT
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {item.checkOut}
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            padding: 14,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginBottom: 4,
            }}
          >
            NEXT CHECK-IN
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {item.nextCheckIn || "—"}
          </div>
        </div>
      </div>

      {action && (
        <button
          onClick={() => onUpdateStatus(item.id, action.status)}
          style={{
            width: "100%",
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default function CleanerPortal({
  cleanings,
  onUpdateStatus,
}: Props) {
  const grouped = useMemo(() => {
    return {
      needsResponse: cleanings.filter(
        (c) => c.status === "Assigned"
      ),

      active: cleanings.filter((c) =>
        ["Accepted", "On The Way", "Cleaning"].includes(c.status)
      ),

      completed: cleanings.filter(
        (c) => c.status === "Ready"
      ),
    };
  }, [cleanings]);

  const sectionTitleStyle = {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 18,
    marginTop: 28,
  } as const;

  return (
    <div
      style={{
        padding: 24,
        background: "#f1f5f9",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        Cleaner Portal
      </div>

      <div
        style={{
          color: "#64748b",
          marginBottom: 28,
        }}
      >
        Manage turnovers and cleaning progress
      </div>

      <div style={sectionTitleStyle}>
        Needs Response
      </div>

      {grouped.needsResponse.map((item) => (
        <CleaningCard
          key={item.id}
          item={item}
          onUpdateStatus={onUpdateStatus}
        />
      ))}

      <div style={sectionTitleStyle}>
        Active Cleanings
      </div>

      {grouped.active.map((item) => (
        <CleaningCard
          key={item.id}
          item={item}
          onUpdateStatus={onUpdateStatus}
        />
      ))}

      <div style={sectionTitleStyle}>
        Ready / Completed
      </div>

      {grouped.completed.map((item) => (
        <CleaningCard
          key={item.id}
          item={item}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </div>
  );
}