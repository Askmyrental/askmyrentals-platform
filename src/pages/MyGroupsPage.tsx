import { useState, type FormEvent } from "react";

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
  onCreateBusinessWorkspace: (businessName: string) => Promise<void>;
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
  onCreateBusinessWorkspace,
  onSignOut,
}: MyGroupsPageProps) {
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState("");

  async function submitBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = businessName.trim();

    if (!normalizedName) {
      setBusinessError("Enter the name of your cleaning business.");
      return;
    }

    setCreatingBusiness(true);
    setBusinessError("");

    try {
      await onCreateBusinessWorkspace(normalizedName);
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : "AMR could not create your business workspace.",
      );
      setCreatingBusiness(false);
    }
  }

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
        <p className="eyebrow">My Workspaces</p>
        <h1>Welcome back{profileName ? `, ${profileName}` : ""}</h1>
        <p>
          Choose where you want to work. Jobs, properties, invoices, payments,
          and team access stay separate between workspaces.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
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
                <small style={{ display: "block", color: "#667085" }}>
                  {String(group.role).toLowerCase() === "owner"
                    ? "Manage properties, cleaners, invoices, and payments."
                    : "Receive assignments, complete work, and view your schedule."}
                </small>
              </span>

              <span style={{ display: "grid", justifyItems: "end", gap: 4 }}>
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

        <article
          style={{
            marginTop: 18,
            padding: 16,
            border: "1px solid #dbeafe",
            borderRadius: 16,
            background: "#f8fbff",
          }}
        >
          <p className="eyebrow">Grow with AMR</p>
          <h2 style={{ marginBottom: 6 }}>Start Your Own Cleaning Business</h2>
          <p className="mutedText">
            Create a separate owner workspace while keeping every team membership and assignment you already have.
          </p>

          {!showBusinessForm ? (
            <button
              type="button"
              className="primaryButton"
              onClick={() => setShowBusinessForm(true)}
            >
              Create My Business
            </button>
          ) : (
            <form
              onSubmit={submitBusiness}
              style={{ display: "grid", gap: 12, marginTop: 14 }}
            >
              <label>
                Business name
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Example: Londyn Cleaning Services"
                  autoFocus
                  required
                />
              </label>

              {businessError && (
                <div className="emptyStateCard" role="alert">
                  <strong>Business workspace needs attention</strong>
                  <p>{businessError}</p>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="secondaryButton"
                  disabled={creatingBusiness}
                  onClick={() => {
                    setShowBusinessForm(false);
                    setBusinessName("");
                    setBusinessError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primaryButton"
                  disabled={creatingBusiness}
                >
                  {creatingBusiness ? "Creating…" : "Create Workspace"}
                </button>
              </div>
            </form>
          )}
        </article>

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
