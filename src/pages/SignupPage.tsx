import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";

type SignupPageProps = {
  accountType: "owner" | "cleaner";
};

export default function SignupPage({
  accountType,
}: SignupPageProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCleaner = accountType === "cleaner";

  const loginPath = isCleaner
    ? "/cleaner/login"
    : "/owner/login";

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: accountType,
            account_type: accountType,
          },
          emailRedirectTo: `${window.location.origin}${loginPath}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        navigate("/app", { replace: true });
        return;
      }

      setMessage(
        `Your ${
          isCleaner ? "cleaner" : "owner"
        } account was created. Check your email to confirm it, then log in.`
      );
    } catch (error) {
      console.error("Signup failed", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the account."
      );
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
          {isCleaner ? "AMR Cleaner" : "AMR Homeowner"}
        </p>

        <h1>
          Create your {isCleaner ? "cleaner" : "owner"} account
        </h1>

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
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
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
            : `Create ${isCleaner ? "Cleaner" : "Owner"} Account`}
        </button>

        <p className="authFooterText">
          Already have an account?{" "}
          <Link to={loginPath}>Log in</Link>
        </p>

        <p className="authFooterText">
          {isCleaner ? (
            <Link to="/owner/signup">
              Creating an owner account?
            </Link>
          ) : (
            <Link to="/cleaner/signup">
              Creating a cleaner account?
            </Link>
          )}
        </p>
      </form>
    </main>
  );
}