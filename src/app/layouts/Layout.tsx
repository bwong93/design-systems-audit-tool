import { Outlet, NavLink as RouterNavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GitCompare,
  Eye,
  Palette,
  Settings,
} from "lucide-react";

export default function Layout() {
  return (
    <div className="flex h-screen bg-neutral-20">
      {/* Sidebar */}
      <aside className="w-56 bg-neutral-100 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-400 flex items-center justify-center shrink-0">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 7h10M7 2v10M4 4l6 6M10 4l-6 6"
                  stroke="#121212"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">
                DS Audit
              </p>
              <p className="text-white/40 text-xs leading-tight">Nucleus</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavLink
            to="/"
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
          />
          <NavLink
            to="/parity"
            icon={<GitCompare size={16} />}
            label="DS Parity"
          />
          <NavLink
            to="/accessibility"
            icon={<Eye size={16} />}
            label="Accessibility"
          />
          <NavLink to="/tokens" icon={<Palette size={16} />} label="Tokens" />
        </nav>

        {/* Settings */}
        <div className="px-3 pb-4 border-t border-white/10 pt-3">
          <NavLink
            to="/settings"
            icon={<Settings size={16} />}
            label="Settings"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
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
        `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
          isActive
            ? "bg-primary-400/15 text-primary-400 font-medium"
            : "text-white/50 hover:text-white/90 hover:bg-white/5"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </RouterNavLink>
  );
}
