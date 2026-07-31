import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../utils/supabase";

type SignupPageProps = {
  accountType: "owner" | "cleaner";
};

export default function SignupPage({
  accountType,
}: SignupPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCleaner = accountType === "cleaner";
  const loginPath = isCleaner ? "/cleaner/login" : "/owner/login";

  const isInvitation = searchParams.get("invited") === "1";
  const groupName = searchParams.get("group")?.trim() ?? "";
  const role = searchParams.get("role")?.trim() ?? "cleaner";

  const roleLabel = useMemo(
    () =>
      role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    [role],
  );

  useEffect(() => {
    const invitedEmail = searchParams.get("email")?.trim() ?? "";
    const invitedFirstName = searchParams.get("firstName")?.trim() ?? "";
    const invitedLastName = searchParams.get("lastName")?.trim() ?? "";

    if (invitedEmail) setEmail(invitedEmail);
    if (invitedFirstName) setFirstName(invitedFirstName);
    if (invitedLastName) setLastName(invitedLastName);
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const fullName = [normalizedFirstName, normalizedLastName]
      .filter(Boolean)
      .join(" ");

    if (!normalizedEmail || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    if (isInvitation && (!normalizedFirstName || !normalizedLastName)) {
      setMessage("Your invitation is missing your first or last name.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const redirectParams = new URLSearchParams({
        confirmed: "1",
        email: normalizedEmail,
      });

      if (isInvitation) {
        redirectParams.set("invited", "1");
        if (groupName) redirectParams.set("group", groupName);
        if (role) redirectParams.set("role", role);
      }

      const redirectUrl =
        `${window.location.origin}${loginPath}?${redirectParams.toString()}`;

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: accountType,
            account_type: accountType,
            first_name: normalizedFirstName || null,
            last_name: normalizedLastName || null,
            full_name: fullName || null,
            display_name: fullName || null,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (data.session) {
        navigate("/app", { replace: true });
        return;
      }

      if (!data.user || (data.user.identities?.length ?? 0) === 0) {
        const loginParams = new URLSearchParams({
          email: normalizedEmail,
        });

        if (isInvitation) {
          loginParams.set("invited", "1");
          if (groupName) loginParams.set("group", groupName);
          if (role) loginParams.set("role", role);
        }

        navigate(`${loginPath}?${loginParams.toString()}`, {
          replace: true,
          state: {
            message:
              "This email already has an AMR account. Log in to continue your invitation, or use Forgot password.",
          },
        });
        return;
      }

      setMessage(
        isInvitation
          ? "Your AMR account was created. Check your email to confirm it, then return to AMR to finish joining the team."
          : `Your ${isCleaner ? "cleaner" : "owner"} account was created. Check your email to confirm it. The confirmation link will return you to the correct AMR login.`,
      );
    } catch (error) {
      console.error("Signup failed", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unable to create the account.";

      const looksLikeExistingAccount =
        /already|registered|exists/i.test(errorMessage);

      if (looksLikeExistingAccount) {
        const loginParams = new URLSearchParams({
          email: normalizedEmail,
        });

        if (isInvitation) {
          loginParams.set("invited", "1");
          if (groupName) loginParams.set("group", groupName);
          if (role) loginParams.set("role", role);
        }

        navigate(`${loginPath}?${loginParams.toString()}`, {
          replace: true,
          state: {
            message:
              "This email already has an AMR account. Log in to continue your invitation, or use Forgot password.",
          },
        });
        return;
      }

      setMessage(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className={`authPage ${
        isCleaner ? "cleanerAuthPage" : "ownerAuthPage"
      }`}
    >
      <form className="authCard" onSubmit={handleSubmit}>
        <Link to="/" className="brandIcon">
          AMR
        </Link>

        <p className="eyebrow">
          {isInvitation
            ? "Team invitation"
            : isCleaner
              ? "AMR Cleaner"
              : "AMR Homeowner"}
        </p>

        <h1>
          {isInvitation
            ? "Create your AMR account"
            : `Create your ${isCleaner ? "cleaner" : "owner"} account`}
        </h1>

        <p>
          {isInvitation
            ? `Your invitation details are already filled in. Create a password to continue joining ${
                groupName || "your AMR team"
              } as a ${roleLabel}.`
            : isCleaner
              ? "Manage properties, schedules, jobs, invoices, and payments."
              : "Stay connected to property operations, schedules, maintenance, and invoices."}
        </p>

        {isInvitation && (
          <div className="authRecoveryNotice">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Invitation details loaded</strong>
              <small>
                Review your information below, then create your password.
              </small>
            </div>
          </div>
        )}

        <label>
          First name
          <input
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
            readOnly={isInvitation && Boolean(firstName)}
          />
        </label>

        <label>
          Last name
          <input
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
            readOnly={isInvitation && Boolean(lastName)}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            readOnly={isInvitation && Boolean(email)}
          />
        </label>

        {isInvitation && email && (
          <p className="mutedText" style={{ marginTop: -6 }}>
            This invitation can only be accepted with this email address.
          </p>
        )}

        <label>
          Create password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 6 characters"
          />
        </label>

        {message && (
          <p className="authMessage" role="alert">
            {message}
          </p>
        )}

        <button
          className="primaryButton"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Creating account..."
            : isInvitation
              ? "Create Account and Continue"
              : `Create ${isCleaner ? "Cleaner" : "Owner"} Account`}
        </button>

        {isInvitation ? (
          <p className="authFooterText">
            Already have an AMR account with this email?{" "}
            <Link
              to={`${loginPath}?email=${encodeURIComponent(
                email.trim(),
              )}&invited=1`}
            >
              Log in instead
            </Link>
          </p>
        ) : (
          <>
            <p className="authFooterText">
              Already have an account?{" "}
              <Link
                to={`${loginPath}?email=${encodeURIComponent(email.trim())}`}
              >
                Log in
              </Link>
            </p>

            <p className="authFooterText">
              {isCleaner ? (
                <Link to="/owner/signup">Creating an owner account?</Link>
              ) : (
                <Link to="/cleaner/signup">Creating a cleaner account?</Link>
              )}
            </p>
          </>
        )}
      </form>
    </main>
  );
}
