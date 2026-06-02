import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./utils/supabase";
import App from "./App";

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

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

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMessage(error.message);
  }

  async function signUp() {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created. Check your email if confirmation is required.");
    }
  }

  if (loading) return <div style={{ padding: 32 }}>Loading Ask My Rentals...</div>;

  if (!session) {
    return (
      <div className="authPage">
        <form className="authCard" onSubmit={signIn}>
          <div className="brandIcon">AMR</div>
          <h1>Ask My Rentals</h1>
          <p>Sign in to manage your property operations.</p>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {message && <p className="authMessage">{message}</p>}

          <button className="primaryButton" type="submit">
            Log In
          </button>

          <button className="ghostButton" type="button" onClick={signUp}>
            Create Account
          </button>
        </form>
      </div>
    );
  }

  return <App />;
}