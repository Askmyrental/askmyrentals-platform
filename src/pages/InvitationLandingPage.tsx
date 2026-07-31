import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function InvitationLandingPage() {
  const [searchParams] = useSearchParams();

  const email = searchParams.get("email")?.trim() ?? "";
  const firstName = searchParams.get("firstName")?.trim() ?? "";
  const lastName = searchParams.get("lastName")?.trim() ?? "";
  const groupName = searchParams.get("group")?.trim() ?? "your AMR team";
  const role = searchParams.get("role")?.trim() ?? "team member";

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const roleLabel = role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const continueParams = new URLSearchParams();

  if (email) continueParams.set("email", email);
  if (firstName) continueParams.set("firstName", firstName);
  if (lastName) continueParams.set("lastName", lastName);

  continueParams.set("group", groupName);
  continueParams.set("role", role);
  continueParams.set("invited", "1");

  useEffect(() => {
    window.localStorage.setItem(
      "amr:pending-invitation",
      JSON.stringify({
        email,
        firstName,
        lastName,
        fullName,
        groupName,
        role,
      }),
    );
  }, [email, firstName, lastName, fullName, groupName, role]);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.hero}>
          <img
            src="/amr-invite-hero.png"
            alt="Luxury vacation rental at sunset"
            style={styles.heroImage}
          />
          <div style={styles.heroShade} />
        </div>

        <div style={styles.content}>
          <div style={styles.iconCircle} aria-hidden="true">
            👥
          </div>

          <div style={styles.eyebrowRow}>
            <span style={styles.eyebrowLine} />
            <p style={styles.eyebrow}>Workspace invitation</p>
            <span style={styles.eyebrowLine} />
          </div>

          <h1 style={styles.title}>
            You’ve been invited to join {groupName}
          </h1>

          <div style={styles.roleBadge}>
            <span aria-hidden="true">🧹</span>
            <span>{roleLabel}</span>
          </div>

          <p style={styles.instruction}>
            Use this email address to continue.
          </p>

          {email && (
            <div style={styles.emailCard}>
              <div style={styles.emailIcon} aria-hidden="true">
                ✉
              </div>

              <div style={styles.emailContent}>
                <span style={styles.emailLabel}>Invited email</span>
                {fullName && <span style={styles.personName}>{fullName}</span>}
                <strong style={styles.email}>{email}</strong>
                <span style={styles.emailNote}>
                  This invitation can only be accepted with this email address.
                </span>
              </div>
            </div>
          )}

          <Link
            to={`/cleaner/signup?${continueParams.toString()}`}
            style={styles.primaryButton}
          >
            <span>Continue Setup</span>
            <span style={styles.arrowCircle} aria-hidden="true">
              →
            </span>
          </Link>

          <div style={styles.securityRow}>
            <span aria-hidden="true">🔒</span>
            <span>Secure invitation • Takes about 30 seconds</span>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 12px",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at top left, #e7f2ff 0, transparent 38%), radial-gradient(circle at bottom right, #dbe8ff 0, transparent 42%), linear-gradient(145deg, #f8fbff 0%, #edf4ff 100%)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  card: {
    width: "100%",
    maxWidth: 690,
    overflow: "hidden",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 24px 60px rgba(42, 75, 140, 0.20)",
    border: "1px solid rgba(172, 198, 235, 0.65)",
  },

  hero: {
    position: "relative",
    height: 176,
    overflow: "hidden",
    background: "#d8edff",
  },

  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center 34%",
    display: "block",
  },

  heroShade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(to bottom, rgba(6, 31, 72, 0.02), rgba(255,255,255,0.18))",
  },

  content: {
    position: "relative",
    marginTop: -34,
    padding: "0 26px 28px",
    textAlign: "center",
  },

  iconCircle: {
    width: 70,
    height: 70,
    margin: "0 auto 15px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 27,
    background: "#ffffff",
    border: "1px solid #cfe0ff",
    boxShadow: "0 10px 24px rgba(54, 105, 211, 0.16)",
  },

  eyebrowRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },

  eyebrowLine: {
    width: 30,
    height: 2,
    background: "#c8d9f5",
  },

  eyebrow: {
    margin: 0,
    color: "#1673ff",
    textTransform: "uppercase",
    letterSpacing: "0.11em",
    fontSize: 12,
    fontWeight: 900,
  },

  title: {
    margin: "0 auto",
    maxWidth: 560,
    color: "#071b44",
    fontSize: "clamp(29px, 5vw, 44px)",
    lineHeight: 1.06,
    letterSpacing: "-0.04em",
    fontWeight: 950,
  },

  roleBadge: {
    width: "fit-content",
    margin: "18px auto 20px",
    padding: "8px 14px",
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#eef5ff",
    color: "#1657c9",
    fontSize: 15,
    fontWeight: 850,
  },

  instruction: {
    margin: "0 0 12px",
    color: "#526582",
    fontSize: 16,
  },

  emailCard: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    alignItems: "center",
    gap: 14,
    padding: "16px 17px",
    borderRadius: 18,
    border: "1px solid #bdd5ff",
    background:
      "linear-gradient(135deg, rgba(241,247,255,0.98), rgba(251,253,255,0.98))",
    boxShadow: "0 10px 22px rgba(64, 112, 190, 0.09)",
    textAlign: "left",
  },

  emailIcon: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    color: "#1b69ff",
    fontSize: 23,
    boxShadow: "0 7px 16px rgba(34, 91, 194, 0.12)",
  },

  emailContent: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },

  emailLabel: {
    color: "#1d67d8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 11,
    fontWeight: 900,
  },

  personName: {
    color: "#4f6281",
    fontSize: 13,
    fontWeight: 700,
  },

  email: {
    color: "#071b44",
    fontSize: "clamp(16px, 4vw, 21px)",
    overflowWrap: "anywhere",
  },

  emailNote: {
    color: "#687a96",
    fontSize: 13,
    lineHeight: 1.35,
  },

  primaryButton: {
    marginTop: 18,
    minHeight: 60,
    padding: "0 14px 0 22px",
    borderRadius: 17,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    background: "linear-gradient(90deg, #174cff 0%, #1687ff 100%)",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 19,
    fontWeight: 900,
    boxShadow: "0 14px 26px rgba(23, 82, 255, 0.24)",
  },

  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    color: "#1768ff",
    fontSize: 22,
  },

  securityRow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    color: "#6a7b95",
    fontSize: 13,
    lineHeight: 1.35,
  },
};
