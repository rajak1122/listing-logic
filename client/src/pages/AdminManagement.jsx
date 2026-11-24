import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  FiShield,
  FiUsers,
  FiUserCheck,
  FiUserX,
  FiSearch,
  FiRefreshCw,
  FiArrowLeft,
  FiLogOut,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiActivity,
  FiKey,
  FiAlertCircle,
  FiLoader,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// ==========================================
// HELPERS
// ==========================================

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getActionLabel = (action) => {
  const labels = {
    ADMIN_GRANTED: "Access granted",
    ADMIN_REVOKED: "Access revoked",
    ADMIN_RESTORED: "Access restored",
  };

  return labels[action] || action;
};

// ==========================================
// REUSABLE UI
// ==========================================

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-2 tabular-nums">
          {value}
        </p>
      </div>

      <div
        className={`w-11 h-11 rounded-xl border flex items-center justify-center ${accent}`}
      >
        <Icon className="text-xl" />
      </div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const active = status === "ACTIVE";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide border ${
        active
          ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
          : "bg-red-400/10 border-red-400/20 text-red-400"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
      {status}
    </span>
  );
};

const RoleBadge = ({ role }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
      role === "SUPER_ADMIN"
        ? "bg-cyan-400/10 border-cyan-400/20 text-cyan-300"
        : "bg-violet-400/10 border-violet-400/20 text-violet-300"
    }`}
  >
    <FiShield />
    {role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
  </span>
);

const SectionHeading = ({ title, description, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
    <div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
    </div>

    {action}
  </div>
);

// ==========================================
// MAIN PAGE
// ==========================================

const AdminManagement = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [admins, setAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [firebaseUid, setFirebaseUid] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  const [notice, setNotice] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  // ==========================================
  // AUTHENTICATED API HELPER
  // ==========================================

  const apiRequest = useCallback(
    async (endpoint, options = {}) => {
      if (!user) {
        throw new Error("Authentication required.");
      }

      const idToken = await user.getIdToken();

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const requestError = new Error(data.message || "Something went wrong.");

        requestError.status = response.status;
        requestError.data = data;

        throw requestError;
      }

      return data;
    },
    [user],
  );

  // ==========================================
  // LOAD ADMIN DATA
  // ==========================================

  const loadData = useCallback(async () => {
    try {
      setPageLoading(true);
      setError("");
      setAccessDenied(false);

      const [adminResponse, auditResponse] = await Promise.all([
        apiRequest("/api/admins?limit=100"),
        apiRequest("/api/admins/audit-logs?limit=50"),
      ]);

      setAdmins(adminResponse.data || []);
      setAuditLogs(auditResponse.data || []);
    } catch (err) {
      console.error("[Admin Management]", err);

      if (err.status === 401) {
        setError("Your session has expired. Please sign in again.");
      } else if (err.status === 403) {
        setAccessDenied(true);
      } else {
        setError(err.message || "Unable to load admin information.");
      }
    } finally {
      setPageLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/admin/login", { replace: true });
      return;
    }

    loadData();
  }, [authLoading, user, navigate, loadData]);

  // ==========================================
  // LOOKUP FIREBASE UID
  // ==========================================

  const handleLookup = async (event) => {
    event.preventDefault();

    if (!firebaseUid.trim()) return;

    try {
      setLookupLoading(true);
      setLookupResult(null);
      setNotice(null);
      setError("");

      const response = await apiRequest("/api/admins/lookup", {
        method: "POST",
        body: JSON.stringify({
          firebaseUid: firebaseUid.trim(),
        }),
      });

      setLookupResult(response.data);
    } catch (err) {
      console.error("[Admin Lookup]", err);
      setError(err.message || "Unable to verify Firebase user.");
    } finally {
      setLookupLoading(false);
    }
  };

  const requestGrantAccess = () => {
    if (!lookupResult?.firebaseUid) return;

    const isRestore =
      lookupResult.existingAdmin?.role === "ADMIN" &&
      lookupResult.existingAdmin?.status === "REVOKED";

    setPendingAction({
      type: "grant",
      targetUid: lookupResult.firebaseUid,
      title: isRestore
        ? "Restore Administrator Access?"
        : "Grant Administrator Access?",
      description: isRestore
        ? `Restore access for ${lookupResult.email || lookupResult.firebaseUid}?`
        : `This will grant ADMIN privileges to ${lookupResult.email || lookupResult.firebaseUid}.`,
      confirmLabel: isRestore ? "Restore Access" : "Grant Access",
    });
  };

  const requestAdminAction = (admin) => {
    const isActive = admin.status === "ACTIVE";

    setPendingAction({
      type: isActive ? "revoke" : "restore",
      targetUid: admin.firebaseUid,
      admin,
      title: isActive
        ? "Revoke Administrator Access?"
        : "Restore Administrator Access?",
      description: isActive
        ? `This administrator will immediately lose access to protected operations.`
        : `Restore ADMIN privileges for ${admin.email || admin.firebaseUid}?`,
      confirmLabel: isActive ? "Revoke Access" : "Restore Access",
    });
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;

    setPendingAction(null);

    if (!action) return;

    if (action.type === "grant") {
      await handleGrantAccess();
      return;
    }

    await handleAdminAction(action.admin);
  };

  // ==========================================
  // GRANT / RESTORE ACCESS
  // ==========================================

  const handleGrantAccess = async () => {
    if (!lookupResult?.firebaseUid) return;

    try {
      setActionLoading(lookupResult.firebaseUid);
      setError("");
      setNotice(null);

      const response = await apiRequest("/api/admins", {
        method: "POST",
        body: JSON.stringify({
          firebaseUid: lookupResult.firebaseUid,
        }),
      });

      setNotice({
        type: "success",
        message: response.message,
      });

      setLookupResult((previous) => ({
        ...previous,
        existingAdmin: {
          role: response.data.role,
          status: response.data.status,
        },
        canGrantAdmin: false,
      }));

      await loadData();
    } catch (err) {
      console.error("[Grant Admin]", err);

      setError(err.message || "Unable to grant admin access.");
    } finally {
      setActionLoading("");
    }
  };

  // ==========================================
  // REVOKE / RESTORE ACCESS
  // ==========================================

  const handleAdminAction = async (admin) => {
    if (admin.role !== "ADMIN") return;

    const isActive = admin.status === "ACTIVE";

    const action = isActive ? "revoke" : "restore";

    try {
      setActionLoading(admin.firebaseUid);
      setNotice(null);
      setError("");

      const response = await apiRequest(
        `/api/admins/${encodeURIComponent(admin.firebaseUid)}/${action}`,
        {
          method: "PATCH",
        },
      );

      setNotice({
        type: "success",
        message: response.message,
      });

      await loadData();
    } catch (err) {
      console.error("[Admin Status Update]", err);

      setError(err.message || "Unable to update admin access.");
    } finally {
      setActionLoading("");
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/admin/login", { replace: true });
    } catch (err) {
      setError("Unable to sign out.");
    }
  };

  // ==========================================
  // DERIVED STATISTICS
  // ==========================================

  const totalAdmins = admins.length;

  const activeAdmins = admins.filter(
    (admin) => admin.status === "ACTIVE",
  ).length;

  const revokedAdmins = admins.filter(
    (admin) => admin.status === "REVOKED",
  ).length;

  const superAdmins = admins.filter(
    (admin) => admin.role === "SUPER_ADMIN",
  ).length;

  // ==========================================
  // AUTH LOADING
  // ==========================================

  if (authLoading || (!user && !accessDenied)) {
    return (
      <div className="min-h-screen bg-darkbg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <FiLoader className="text-2xl animate-spin text-emerald-400" />
          <p className="text-sm">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ACCESS DENIED
  // ==========================================

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-darkbg flex items-center justify-center px-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-500/10 blur-[130px] rounded-full" />

        <div className="glass-card max-w-md w-full p-8 text-center relative z-10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center mb-5">
            <FiShield className="text-2xl text-red-400" />
          </div>

          <h1 className="text-xl font-semibold text-white">Restricted Area</h1>

          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            Your account does not have Super Admin permissions to access this
            management portal.
          </p>

          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition"
          >
            <FiArrowLeft />
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN ADMIN MANAGEMENT UI
  // ==========================================

  return (
    <div className="min-h-screen bg-darkbg text-slate-100 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-[-180px] left-[-150px] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-180px] right-[-150px] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f19]/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glowGreen">
              <FiShield className="text-xl" />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-wide text-white">
                Listing<span className="text-emerald-400">Logic</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Admin Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-slate-300">{user.email}</p>
              <p className="text-[10px] text-cyan-300">Super Administrator</p>
            </div>

            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition"
            >
              <FiArrowLeft />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg bg-red-400/[0.07] border border-red-400/20 text-red-400 hover:bg-red-400/[0.15] transition"
              title="Sign out"
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8 relative z-10">
        {/* Page Introduction */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-2">
              <FiKey />
              Access Control
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Administrator Management
            </h1>

            <p className="text-sm text-slate-400 mt-2">
              Manage administrator access, roles and account activity.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={pageLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/10 transition disabled:opacity-50"
          >
            <FiRefreshCw className={pageLoading ? "animate-spin" : ""} />
            Refresh Data
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 rounded-xl bg-red-400/[0.08] border border-red-400/20 p-4 flex items-start gap-3">
            <FiAlertCircle className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-5 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/20 p-4 flex items-start gap-3">
            <FiCheckCircle className="text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-300">{notice.message}</p>
          </div>
        )}

        {/* Overview Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={FiUsers}
            label="Total Administrators"
            value={pageLoading ? "—" : totalAdmins}
            accent="bg-cyan-400/10 border-cyan-400/20 text-cyan-300"
          />

          <StatCard
            icon={FiUserCheck}
            label="Active Accounts"
            value={pageLoading ? "—" : activeAdmins}
            accent="bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
          />

          <StatCard
            icon={FiUserX}
            label="Revoked Accounts"
            value={pageLoading ? "—" : revokedAdmins}
            accent="bg-red-400/10 border-red-400/20 text-red-400"
          />

          <StatCard
            icon={FiShield}
            label="Super Administrators"
            value={pageLoading ? "—" : superAdmins}
            accent="bg-violet-400/10 border-violet-400/20 text-violet-300"
          />
        </section>

        {/* Grant Admin Access */}
        <section className="glass-card p-5 sm:p-6 mb-8">
          <SectionHeading
            title="Grant Administrator Access"
            description="Verify a Firebase account using its UID before assigning ADMIN permissions."
          />

          <form
            onSubmit={handleLookup}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />

              <input
                value={firebaseUid}
                onChange={(event) => {
                  setFirebaseUid(event.target.value);
                  setLookupResult(null);
                  setError("");
                }}
                placeholder="Enter Firebase UID..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/20 border border-white/10 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10 transition"
              />
            </div>

            <button
              type="submit"
              disabled={lookupLoading || !firebaseUid.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/15 border border-emerald-400/30 text-emerald-300 text-sm font-semibold hover:border-emerald-400/60 transition disabled:opacity-40"
            >
              {lookupLoading ? (
                <FiLoader className="animate-spin" />
              ) : (
                <FiSearch />
              )}

              {lookupLoading ? "Verifying..." : "Verify User"}
            </button>
          </form>

          {/* Lookup Result */}
          {lookupResult && (
            <div className="mt-5 rounded-xl bg-white/[0.035] border border-white/10 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <FiCheckCircle className="text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">
                      Firebase account verified
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white break-all">
                    {lookupResult.displayName || "Unnamed account"}
                  </h3>

                  <p className="text-sm text-slate-400 mt-1 break-all">
                    {lookupResult.email || "No email available"}
                  </p>

                  <p className="text-[11px] text-slate-500 mt-3 font-mono break-all">
                    UID: {lookupResult.firebaseUid}
                  </p>

                  <p className="text-[11px] text-slate-500 mt-2">
                    Email verified: {lookupResult.emailVerified ? "Yes" : "No"}
                  </p>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
                  {lookupResult.existingAdmin ? (
                    <>
                      <RoleBadge role={lookupResult.existingAdmin.role} />
                      <StatusBadge status={lookupResult.existingAdmin.status} />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">
                      No existing admin access
                    </span>
                  )}

                  {lookupResult.canGrantAdmin && (
                    <button
                      onClick={requestGrantAccess}
                      disabled={actionLoading === lookupResult.firebaseUid}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-400/20 transition disabled:opacity-50"
                    >
                      {actionLoading === lookupResult.firebaseUid ? (
                        <FiLoader className="animate-spin" />
                      ) : (
                        <FiUserCheck />
                      )}

                      {lookupResult.existingAdmin?.status === "REVOKED"
                        ? "Restore Admin Access"
                        : "Grant Admin Access"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Admin Directory */}
        <section className="glass-card p-5 sm:p-6 mb-8">
          <SectionHeading
            title="Administrator Directory"
            description="Review administrator accounts and manage their access status."
            action={
              <span className="px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-[10px] font-semibold">
                {admins.length} RECORDS
              </span>
            }
          />

          {pageLoading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
              <FiLoader className="text-xl animate-spin text-emerald-400" />
              <p className="text-xs">Loading administrator records...</p>
            </div>
          ) : admins.length === 0 ? (
            <div className="py-12 text-center">
              <FiUsers className="text-3xl text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                No administrator records found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-3 font-semibold">Administrator</th>
                    <th className="py-4 px-3 font-semibold">Role</th>
                    <th className="py-4 px-3 font-semibold">Status</th>
                    <th className="py-4 px-3 font-semibold">Added On</th>
                    <th className="py-4 px-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {admins.map((admin) => (
                    <tr
                      key={admin.firebaseUid}
                      className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.025] transition"
                    >
                      <td className="py-4 px-3">
                        <p className="text-sm font-medium text-slate-200">
                          {admin.displayName || "Unnamed user"}
                        </p>

                        <p className="text-xs text-slate-500 mt-1">
                          {admin.email || "No email"}
                        </p>

                        <p className="text-[10px] text-slate-600 font-mono mt-1">
                          {admin.firebaseUid}
                        </p>
                      </td>

                      <td className="py-4 px-3">
                        <RoleBadge role={admin.role} />
                      </td>

                      <td className="py-4 px-3">
                        <StatusBadge status={admin.status} />
                      </td>

                      <td className="py-4 px-3 text-xs text-slate-400">
                        {formatDate(admin.createdAt)}
                      </td>

                      <td className="py-4 px-3 text-right">
                        {admin.role === "SUPER_ADMIN" ? (
                          <span className="text-[10px] text-slate-600">
                            Protected
                          </span>
                        ) : (
                          <button
                            onClick={() => requestAdminAction(admin)}
                            disabled={actionLoading === admin.firebaseUid}
                            className={`px-3 py-2 rounded-lg border text-[11px] font-semibold transition disabled:opacity-40 ${
                              admin.status === "ACTIVE"
                                ? "bg-red-400/[0.07] border-red-400/20 text-red-400 hover:bg-red-400/15"
                                : "bg-emerald-400/[0.07] border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/15"
                            }`}
                          >
                            {actionLoading === admin.firebaseUid ? (
                              <FiLoader className="animate-spin" />
                            ) : admin.status === "ACTIVE" ? (
                              "Revoke Access"
                            ) : (
                              "Restore Access"
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Audit History */}
        <section className="glass-card p-5 sm:p-6">
          <SectionHeading
            title="Access Activity"
            description="A record of administrator permission changes."
            action={
              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <FiActivity />
                AUDIT TRAIL
              </span>
            }
          />

          {pageLoading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Loading activity...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-10 text-center">
              <FiClock className="text-2xl text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                No access activity recorded yet.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Granting, revoking or restoring admin access will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => {
                const granted = log.action === "ADMIN_GRANTED";
                const restored = log.action === "ADMIN_RESTORED";

                return (
                  <div
                    key={log._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.025] border border-white/[0.06]"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          granted || restored
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-red-400/10 text-red-400"
                        }`}
                      >
                        {granted || restored ? <FiUserCheck /> : <FiUserX />}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">
                          {getActionLabel(log.action)}
                        </p>

                        <p className="text-xs text-slate-400 mt-1 break-all">
                          {log.targetEmail || log.targetFirebaseUid}
                        </p>

                        <p className="text-[10px] text-slate-600 mt-1 break-all">
                          Performed by: {log.actorEmail || log.actorFirebaseUid}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="text-center py-8">
          <p className="text-[10px] text-slate-600">
            ListingLogic © 2026 · Administrator Access Control
          </p>
        </footer>
      </main>

      {pendingAction && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingAction(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            className="glass-card w-full max-w-md p-6 sm:p-7"
          >
            <div
              className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 ${
                pendingAction.type === "revoke"
                  ? "bg-red-400/10 border-red-400/20 text-red-400"
                  : "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
              }`}
            >
              {pendingAction.type === "revoke" ? (
                <FiUserX className="text-xl" />
              ) : (
                <FiShield className="text-xl" />
              )}
            </div>

            <h2
              id="admin-confirm-title"
              className="text-lg font-semibold text-white"
            >
              {pendingAction.title}
            </h2>

            <p className="text-sm text-slate-400 leading-relaxed mt-3">
              {pendingAction.description}
            </p>

            <div className="mt-7 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => setPendingAction(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/10 transition"
              >
                Cancel
              </button>

              <button
                disabled={actionLoading === pendingAction.targetUid}
                onClick={confirmPendingAction}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition disabled:opacity-50 ${
                  pendingAction.type === "revoke"
                    ? "bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20"
                    : "bg-emerald-400/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/20"
                }`}
              >
                {pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
