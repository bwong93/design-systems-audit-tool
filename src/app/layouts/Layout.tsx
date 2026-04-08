import { Outlet, NavLink as RouterNavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GitCompare,
  Eye,
  Palette,
  Settings,
  RefreshCw,
  Loader2,
} from "lucide-react";
import ScanToast from "../components/ScanToast";
import { useAuditStore } from "../../stores/audit-store";

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo/Title */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Loupe</h1>
            <p className="text-sm text-gray-500 mt-1">Design · Code · Parity</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <NavLink
              to="/"
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
            />
            <NavLink
              to="/parity"
              icon={<GitCompare size={20} />}
              label="Figma Parity"
            />
            <NavLink
              to="/accessibility"
              icon={<Eye size={20} />}
              label="Accessibility"
            />
            <NavLink to="/tokens" icon={<Palette size={20} />} label="Tokens" />
          </nav>

          {/* Footer actions */}
          <div className="p-4 border-t border-gray-200 space-y-1">
            <RescanButton />
            <NavLink
              to="/settings"
              icon={<Settings size={20} />}
              label="Settings"
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <ScanToast />
    </div>
  );
}

function RescanButton() {
  const { isScanning, results, startScan } = useAuditStore();

  if (!results) return null;

  return (
    <button
      onClick={startScan}
      disabled={isScanning}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isScanning ? (
        <Loader2 size={20} className="animate-spin shrink-0" />
      ) : (
        <RefreshCw size={20} className="shrink-0" />
      )}
      <span>{isScanning ? "Scanning..." : "Re-scan"}</span>
    </button>
  );
}

function NavLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <RouterNavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
          isActive
            ? "bg-primary-50 text-primary-700 font-medium"
            : "text-gray-600 hover:bg-gray-100"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </RouterNavLink>
  );
}
