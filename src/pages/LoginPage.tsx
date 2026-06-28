import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    navigate("/app");
  }

  return (
    <main className="authPage">
      <form className="authCard" onSubmit={handleSubmit}>
        <Link to="/" className="brandIcon">
          AMR
        </Link>

        <p className="eyebrow">Ask My Rentals</p>
        <h1>Welcome back</h1>
        <p>Log in to manage your vacation rental operations.</p>

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
            placeholder="Your password"
          />
        </label>

        {message && <p className="authMessage">{message}</p>}

        <button className="primaryButton" type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Log In"}
        </button>

        <p className="authFooterText">
          New to Ask My Rentals? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  );
}