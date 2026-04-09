import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./app/layouts/Layout";
import Dashboard from "./app/pages/Dashboard";
import Onboarding from "./app/pages/Onboarding";
import ParityView from "./app/pages/ParityView";
import Accessibility from "./app/pages/Accessibility";
import Tokens from "./app/pages/Tokens";
import Settings from "./app/pages/Settings";
import Impact from "./app/pages/Impact";
import { useOnboardingStore } from "./stores/onboarding-store";
import { useAuditStore } from "./stores/audit-store";

function App() {
  const { completed } = useOnboardingStore();
  const hydrate = useAuditStore((s) => s.hydrate);

  useEffect(() => {
    if (completed) hydrate();
  }, [completed, hydrate]);

  if (!completed) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Onboarding />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="parity" element={<ParityView />} />
          <Route path="accessibility" element={<Accessibility />} />
          <Route path="tokens" element={<Tokens />} />
          <Route path="impact" element={<Impact />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
