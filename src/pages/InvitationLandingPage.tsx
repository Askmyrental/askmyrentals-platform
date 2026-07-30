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

  const signupParams = new URLSearchParams();
  const loginParams = new URLSearchParams();

  if (email) {
    signupParams.set("email", email);
    loginParams.set("email", email);
  }

  if (firstName) {
    signupParams.set("firstName", firstName);
  }

  if (lastName) {
    signupParams.set("lastName", lastName);
  }

  signupParams.set("group", groupName);
  signupParams.set("role", role);

  loginParams.set("group", groupName);
  loginParams.set("role", role);

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
        <Link to="/" className="brandIcon">
          AMR
        </Link>

        <p className="eyebrow">Workspace invitation</p>
        <h1>
          {firstName ? `${firstName}, you’ve` : "You’ve"} been invited to{" "}
          {groupName}
        </h1>
        <p>
          You were invited as <strong>{role.replace(/_/g, " ")}</strong>.
          Use the exact invited email address to continue.
        </p>

        {(fullName || email) && (
          <div className="authRecoveryNotice">
            <span aria-hidden="true">✉️</span>
            <div>
              {fullName && <strong>{fullName}</strong>}
              {email && <small>{email}</small>}
              <small>This invitation is tied to this account information.</small>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <Link
            className="primaryButton"
            to={`/cleaner/signup?${signupParams.toString()}`}
          >
            Create My AMR Account
          </Link>

          <Link
            className="secondaryButton"
            to={`/cleaner/login?${loginParams.toString()}`}
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
