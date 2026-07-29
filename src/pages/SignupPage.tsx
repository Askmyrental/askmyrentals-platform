import { useEffect, useState } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCleaner = accountType === "cleaner";
  const loginPath = isCleaner ? "/cleaner/login" : "/owner/login";

  useEffect(() => {
    const invitedEmail = searchParams.get("email")?.trim() ?? "";
    if (invitedEmail) setEmail(invitedEmail);
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const redirectUrl =
        `${window.location.origin}${loginPath}` +
        `?confirmed=1&email=${encodeURIComponent(normalizedEmail)}`;

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: accountType,
            account_type: accountType,
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
        setMessage(
          "This email may already have an AMR account. Try logging in or use password recovery."
        );
        return;
      }

      setMessage(
        `Your ${isCleaner ? "cleaner" : "owner"} account was created. Check your email to confirm it. The confirmation link will return you to the correct AMR login.`
      );
    } catch (error) {
      console.error("Signup failed", error);
      setMessage(
        error instanceof Error ? error.message : "Unable to create the account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={`authPage ${isCleaner ? "cleanerAuthPage" : "ownerAuthPage"}`}>
      <form className="authCard" onSubmit={handleSubmit}>
        <Link to="/" className="brandIcon">AMR</Link>

        <p className="eyebrow">
          {isCleaner ? "AMR Cleaner" : "AMR Homeowner"}
        </p>

        <h1>Create your {isCleaner ? "cleaner" : "owner"} account</h1>

        <p>
          {isCleaner
            ? "Manage properties, schedules, jobs, invoices, and payments."
            : "Stay connected to property operations, schedules, maintenance, and invoices."}
        </p>

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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 6 characters"
          />
        </label>

        {message && <p className="authMessage" role="alert">{message}</p>}

        <button className="primaryButton" type="submit" disabled={submitting}>
          {submitting
            ? "Creating account..."
            : `Create ${isCleaner ? "Cleaner" : "Owner"} Account`}
        </button>

        <p className="authFooterText">
          Already have an account?{" "}
          <Link to={`${loginPath}?email=${encodeURIComponent(email.trim())}`}>
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
      </form>
    </main>
  );
}
