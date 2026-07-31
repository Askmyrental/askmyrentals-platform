import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const invitedEmail = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("email")?.trim() ?? "";
  }, [location.search]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(
    "Open the password-reset link from your email to continue.",
  );
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function restoreRecoverySession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        setReady(true);
        setMessage("Create a new password for your AMR account.");
      }
    }

    void restoreRecoverySession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (event === "PASSWORD_RECOVERY" || session) {
          setReady(true);
          setMessage("Create a new password for your AMR account.");
        }
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!ready) {
      setMessage(
        "This reset link is missing or expired. Request a new password-reset email.",
      );
      return;
    }

    if (newPassword.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setMessage(
      "Your password was updated. Return to AMR to continue your team invitation.",
    );
  }

  function returnToAmr() {
    const query = invitedEmail
      ? `?email=${encodeURIComponent(invitedEmail)}`
      : "";

    navigate(`/login${query}`, { replace: true });
  }

  return (
    <main className="authPage">
      <form className="authCard" onSubmit={handleSubmit}>
        <Link to="/" className="brandIcon" aria-label="Ask My Rentals home">
          AMR
        </Link>

        <p className="eyebrow">Account recovery</p>
        <h1>{saved ? "Password updated" : "Create a new password"}</h1>
        <p>
          {saved
            ? "You can now return to AMR, sign in, and accept your pending team invitation."
            : "Choose a secure password for your existing AMR account."}
        </p>

        {!saved && (
          <>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={!ready || saving}
                required
              />
            </label>

            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Enter the password again"
                autoComplete="new-password"
                disabled={!ready || saving}
                required
              />
            </label>
          </>
        )}

        {message && (
          <p className="authMessage" role="status" aria-live="polite">
            {message}
          </p>
        )}

        {saved ? (
          <button
            className="primaryButton"
            type="button"
            onClick={returnToAmr}
          >
            Return to AMR
          </button>
        ) : (
          <button
            className="primaryButton"
            type="submit"
            disabled={!ready || saving}
          >
            {saving ? "Saving password…" : "Save Password"}
          </button>
        )}

        {!saved && (
          <p className="authFooterText">
            Need another link?{" "}
            <Link
              to={`/login${
                invitedEmail
                  ? `?email=${encodeURIComponent(invitedEmail)}`
                  : ""
              }`}
            >
              Return to login
            </Link>
          </p>
        )}
      </form>
    </main>
  );
}
