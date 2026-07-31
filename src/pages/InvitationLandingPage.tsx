import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function InvitationLandingPage() {
  const [searchParams] = useSearchParams();

  const email = searchParams.get("email")?.trim() ?? "";
  const firstName = searchParams.get("firstName")?.trim() ?? "";
  const lastName = searchParams.get("lastName")?.trim() ?? "";
  const groupName = searchParams.get("group")?.trim() ?? "an AMR team";
  const role = searchParams.get("role")?.trim() ?? "team member";

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const roleLabel = role.replace(/_/g, " ");

  const continueParams = new URLSearchParams();

  if (email) {
    continueParams.set("email", email);
  }

  if (firstName) {
    continueParams.set("firstName", firstName);
  }

  if (lastName) {
    continueParams.set("lastName", lastName);
  }

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
    <main className="authPage cleanerAuthPage">
      <section className="authCard" style={{ maxWidth: 620 }}>
        <Link to="/" className="brandIcon" aria-label="Ask My Rentals home">
          AMR
        </Link>

        <p className="eyebrow">Workspace invitation</p>

        <h1>
          {firstName ? `${firstName}, you’ve` : "You’ve"} been invited to join{" "}
          {groupName}
        </h1>

        <p>
          You were invited as a <strong>{roleLabel}</strong>. Continue with the
          invited email address below.
        </p>

        {(fullName || email) && (
          <div className="authRecoveryNotice">
            <span aria-hidden="true">✉️</span>

            <div>
              {fullName && <strong>{fullName}</strong>}
              {email && <small>{email}</small>}
              <small>
                This invitation can only be accepted using this email address.
              </small>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <Link
            className="primaryButton"
            to={`/cleaner/signup?${continueParams.toString()}`}
          >
            Continue
          </Link>
        </div>

        <p className="authFooterText" style={{ marginTop: 18 }}>
          AMR will guide you through signing in or creating your account, then
          show the final invitation acceptance screen.
        </p>
      </section>
    </main>
  );
}
