import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./utils/supabase";
import App from "./App";

type AuthMode = "login" | "signup";

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) setMessage(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Account created. Check your email to confirm your account, then come back and log in.");
        setMode("login");
      }
    }

    setSubmitting(false);
  }

  if (loading) {
    return <div style={{ padding: 32 }}>Loading Ask My Rentals...</div>;
  }

  if (!session) {
    return (
      <div className="authPage">
        <form className="authCard" onSubmit={handleSubmit}>
          <div className="brandIcon">AMR</div>

          <p className="eyebrow">Owner Operations</p>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>
            {mode === "login"
              ? "Log in to manage your property operations."
              : "Start setting up your first rental property."}
          </p>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
            />
          </label>

          {message && <p className="authMessage">{message}</p>}

          <button className="primaryButton" type="submit" disabled={submitting}>
            {submitting
              ? "Working..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </button>

          {mode === "login" ? (
            <button className="ghostButton" type="button" onClick={() => setMode("signup")}>
              Need an account? Create one
            </button>
          ) : (
            <button className="ghostButton" type="button" onClick={() => setMode("login")}>
              Already have an account? Log in
            </button>
          )}
        </form>
      </div>
    );
  }

  return <App />;
}