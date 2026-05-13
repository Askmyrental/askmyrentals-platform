import { useMemo } from "react";

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const date = new Date(dateString);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}-${day}-${year}`;
}

function getUrgency(arrival?: string) {
  if (!arrival) return null;

  const today = new Date();
  const arrivalDate = new Date(arrival);

  today.setHours(0, 0, 0, 0);
  arrivalDate.setHours(0, 0, 0, 0);

  const diff =
    (arrivalDate.getTime() - today.getTime()) /
    (1000 * 60 * 60 * 24);

  if (diff <= 0) {
    return { label: "Guest Arrives Today", color: "#dc2626" };
  }

  if (diff === 1) {
    return { label: "Guest Arrives Tomorrow", color: "#ea580c" };
  }

  return { label: "Upcoming Stay", color: "#16a34a" };
}
type Props = {
  cleanings: any[];
  onUpdateStatus: any;
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
  item: any;
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
const urgency = getUrgency(item.arrival);
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
        {urgency && (
  <div
    style={{
      marginTop: 10,
      background: urgency.color,
      color: "white",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      display: "inline-block",
    }}
  >
    {urgency.label}
  </div>
)}
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
          {formatDate(item.departure)} 
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
          {formatDate(item.arrival)} 
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

      active: cleanings
  .filter((c) =>
    ["Accepted", "On The Way", "Cleaning"].includes(c.status)
  )
  .sort(
    (a, b) =>
      new Date(a.arrival || 0).getTime() -
      new Date(b.arrival || 0).getTime()
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
 <div style={sectionTitleStyle}>
  Needs Response ({grouped.needsResponse.length})
</div>
      </div>
{cleanings.length === 0 && (
  <div
    style={{
      background: "white",
      padding: 24,
      borderRadius: 16,
      color: "#64748b",
      border: "1px solid #e2e8f0",
    }}
  >
    No assigned cleanings yet.
  </div>
)}
      {grouped.needsResponse.map((item) => (
        <CleaningCard
          key={item.id}
          item={item}
          onUpdateStatus={onUpdateStatus}
        />
      ))}

      <div style={sectionTitleStyle}>
 <div style={sectionTitleStyle}>
  Active Cleanings ({grouped.active.length})
</div>
      </div>

      {grouped.active.map((item) => (
        <CleaningCard
          key={item.id}
          item={item}
          onUpdateStatus={onUpdateStatus}
        />
      ))}

      <div style={sectionTitleStyle}>
 <div style={sectionTitleStyle}>
  Ready / Completed ({grouped.completed.length})
</div>
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