import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../utils/supabase";

type AccountRole = "owner" | "cleaner" | "employee";

type LoginPageProps = {
  expectedRole?: "owner" | "cleaner";
};

export default function LoginPage({ expectedRole }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCleanerLogin = expectedRole === "cleaner";
  const isOwnerLogin = expectedRole === "owner";

  useEffect(() => {
    const emailFromLink = searchParams.get("email")?.trim() ?? "";
    if (emailFromLink) setEmail(emailFromLink);

    if (searchParams.get("confirmed") === "1") {
      setMessage(
        "Your email is confirmed. Log in to continue to your AMR invitation or workspace."
      );
    }
  }, [searchParams]);

  const pageTitle = isCleanerLogin
    ? "Cleaner Login"
    : isOwnerLogin
      ? "Owner Login"
      : "Welcome back";

  const pageDescription = isCleanerLogin
    ? "Manage your properties, schedule, jobs, invoices, and payments."
    : isOwnerLogin
      ? "View your rental operations, schedules, maintenance, and invoices."
      : "Log in to your Ask My Rentals account.";

  const signupPath = isCleanerLogin
    ? "/cleaner/signup"
    : isOwnerLogin
      ? "/owner/signup"
      : "/signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (loginError) throw loginError;

      const user = loginData.user;
      if (!user) throw new Error("Unable to find the signed-in user.");

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.role) {
        const { data: pendingInvites, error: inviteError } =
          await supabase.rpc("get_my_pending_group_invites");

        if (inviteError) {
          console.error("Unable to check pending AMR invitations", inviteError);
          await supabase.auth.signOut();
          setMessage(
            "AMR could not verify your account invitation. Please try again."
          );
          return;
        }

        if ((pendingInvites ?? []).length > 0) {
          navigate("/app", { replace: true });
          return;
        }

        await supabase.auth.signOut();
        setMessage(
          "This account is confirmed, but it is not connected to an AMR workspace or pending invitation."
        );
        return;
      }

      const actualRole = profile.role as AccountRole;
      const isAllowedCleanerRole =
        expectedRole === "cleaner" &&
        (actualRole === "cleaner" || actualRole === "employee");
      const isAllowedOwnerRole =
        expectedRole === "owner" && actualRole === "owner";

      if (!(!expectedRole || isAllowedCleanerRole || isAllowedOwnerRole)) {
        await supabase.auth.signOut();

        if (actualRole === "cleaner" || actualRole === "employee") {
          setMessage(
            "This account is registered for AMR Cleaner. Please use Cleaner Login."
          );
        } else {
          setMessage(
            "This account is registered as a homeowner. Please use Owner Login."
          );
        }
        return;
      }

      navigate("/app", { replace: true });
    } catch (error) {
      console.error("Login failed", error);
      setMessage(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={`authPage ${
      isCleanerLogin ? "cleanerAuthPage" : isOwnerLogin ? "ownerAuthPage" : ""
    }`}>
      <form className="authCard" onSubmit={handleSubmit}>
        <Link to="/" className="brandIcon">AMR</Link>

        <p className="eyebrow">
          {isCleanerLogin
            ? "AMR Cleaner"
            : isOwnerLogin
              ? "AMR Homeowner"
              : "Ask My Rentals"}
        </p>

        <h1>{pageTitle}</h1>
        <p>{pageDescription}</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </label>

        {message && <p className="authMessage" role="alert">{message}</p>}

        <button className="primaryButton" type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Log In"}
        </button>

        <p className="authFooterText">
          New to AMR?{" "}
          <Link to={`${signupPath}?email=${encodeURIComponent(email.trim())}`}>
            Create an account
          </Link>
        </p>

        {expectedRole && (
          <p className="authFooterText">
            {isCleanerLogin ? (
              <Link to="/owner/login">Looking for Owner Login?</Link>
            ) : (
              <Link to="/cleaner/login">Looking for Cleaner Login?</Link>
            )}
          </p>
        )}
      </form>
    </main>
  );
}
