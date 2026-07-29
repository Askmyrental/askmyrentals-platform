type GroupOption = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  role: string;
};

type MyGroupsPageProps = {
  groups: GroupOption[];
  profileName: string;
  onSelectGroup: (groupId: string) => void;
  onSignOut: () => void;
};

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MyGroupsPage({
  groups,
  profileName,
  onSelectGroup,
  onSignOut,
}: MyGroupsPageProps) {
  return (
    <div className="authPage">
      <section
        className="authCard"
        style={{
          width: "min(760px, calc(100vw - 32px))",
          maxWidth: 760,
        }}
      >
        <div className="brandIcon">AMR</div>
        <p className="eyebrow">My Groups</p>
        <h1>Welcome back{profileName ? `, ${profileName}` : ""}</h1>
        <p>
          Choose the company or team you want to open. Information stays
          separate between groups.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 22,
          }}
        >
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "52px 1fr auto",
                alignItems: "center",
                gap: 14,
                padding: 16,
                border: "1px solid #dbe2ea",
                borderRadius: 16,
                background: "#ffffff",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 52,
                  height: 52,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: "#eef2f7",
                  fontWeight: 800,
                  fontSize: 18,
                  overflow: "hidden",
                }}
              >
                {group.logoUrl ? (
                  <img
                    src={group.logoUrl}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  group.name.slice(0, 2).toUpperCase()
                )}
              </span>

              <span style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: 17,
                    marginBottom: 4,
                  }}
                >
                  {group.name}
                </strong>
                <small
                  style={{
                    display: "block",
                    color: "#667085",
                  }}
                >
                  {group.description?.trim() ||
                    `Open as ${formatRole(group.role)}`}
                </small>
              </span>

              <span
                style={{
                  display: "grid",
                  justifyItems: "end",
                  gap: 4,
                }}
              >
                <small
                  style={{
                    padding: "5px 9px",
                    borderRadius: 999,
                    background: "#eef2f7",
                    fontWeight: 700,
                  }}
                >
                  {formatRole(group.role)}
                </small>
                <span aria-hidden="true">›</span>
              </span>
            </button>
          ))}
        </div>

        <button
          className="secondaryButton"
          type="button"
          onClick={onSignOut}
          style={{ marginTop: 20 }}
        >
          Sign Out
        </button>
      </section>
    </div>
  );
}
