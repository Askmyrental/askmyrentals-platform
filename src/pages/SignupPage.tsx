import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";

export default function SignupPage() {
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

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage("Account created. Check your email to confirm your account, then log in.");
    setSubmitting(false);
    navigate("/login");
  }

  return (
    <main className="authPage">
      <form className="authCard" onSubmit={handleSubmit}>
        <Link to="/" className="brandIcon">
          AMR
        </Link>

        <p className="eyebrow">Ask My Rentals</p>
        <h1>Create your account</h1>
        <p>Start managing your first rental property.</p>

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
          {submitting ? "Creating account..." : "Create Account"}
        </button>

        <p className="authFooterText">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}