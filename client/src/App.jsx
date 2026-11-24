import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { Dashboard } from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import IpoAnalysis from "./pages/IpoAnalysis";
import AdminLogin from "./pages/AdminLogin";
import AdminManagement from "./pages/AdminManagement";

const SessionLoadingScreen = () => (
  <div className="min-h-screen bg-darkbg flex items-center justify-center px-5">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-xl border border-emerald-400/30 border-t-emerald-400 animate-spin" />
      <p className="text-sm text-slate-400">
        Preparing your ListingLogic workspace...
      </p>
    </div>
  </div>
);

// Root route:
// - Signed-out visitors see the public SaaS landing page.
// - Any authenticated Google user sees the IPO dashboard.
const HomeRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <SessionLoadingScreen />;
  }

  return user ? <Dashboard /> : <LandingPage />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<AdminLogin />} />

          {/* Backward compatibility for previously shared admin-login URLs. */}
          <Route
            path="/admin/login"
            element={<Navigate to="/login" replace />}
          />

          <Route path="/ipo/:id" element={<IpoAnalysis />} />
          <Route path="/admin/manage" element={<AdminManagement />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
