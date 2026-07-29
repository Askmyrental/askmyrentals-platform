import { Link, useSearchParams } from "react-router-dom";

export default function InvitationLandingPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const groupName = searchParams.get("group")?.trim() ?? "an AMR team";
  const role = searchParams.get("role")?.trim() ?? "team member";
  const encodedEmail = encodeURIComponent(email);

  return (
    <main className="authPage cleanerAuthPage">
      <section className="authCard" style={{ maxWidth: 620 }}>
        <Link to="/" className="brandIcon">AMR</Link>

        <p className="eyebrow">Workspace invitation</p>
        <h1>You’ve been invited to {groupName}</h1>
        <p>
          You were invited as <strong>{role.replace(/_/g, " ")}</strong>.
          Use the exact invited email address to continue.
        </p>

        {email && (
          <div className="authRecoveryNotice">
            <span aria-hidden="true">✉️</span>
            <div>
              <strong>{email}</strong>
              <small>This invitation is tied to this email address.</small>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <Link
            className="primaryButton"
            to={`/cleaner/signup?email=${encodedEmail}`}
          >
            Create My AMR Account
          </Link>

          <Link
            className="secondaryButton"
            to={`/cleaner/login?email=${encodedEmail}`}
          >
            I Already Have an Account
          </Link>
        </div>

        <p className="authFooterText" style={{ marginTop: 18 }}>
          After confirming your email and logging in, AMR will show the final
          Accept Invitation screen.
        </p>
      </section>
    </main>
  );
}
