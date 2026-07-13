import { Navigate, Route, Routes } from "react-router-dom";
import AuthGate from "./AuthGate";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/owner/login"
        element={<LoginPage expectedRole="owner" />}
      />

      <Route
        path="/cleaner/login"
        element={<LoginPage expectedRole="cleaner" />}
      />

      <Route
        path="/owner/signup"
        element={<SignupPage accountType="owner" />}
      />

      <Route
        path="/cleaner/signup"
        element={<SignupPage accountType="cleaner" />}
      />

      <Route
        path="/login"
        element={<Navigate to="/" replace />}
      />

      <Route
        path="/signup"
        element={<Navigate to="/" replace />}
      />

      <Route path="/app" element={<AuthGate />} />
    </Routes>
  );
}