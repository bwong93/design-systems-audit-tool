import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./app/layouts/Layout";
import Dashboard from "./app/pages/Dashboard";
import Onboarding from "./app/pages/Onboarding";
import ParityView from "./app/pages/ParityView";
import Accessibility from "./app/pages/Accessibility";
import Tokens from "./app/pages/Tokens";
import Settings from "./app/pages/Settings";
import { useOnboardingStore } from "./stores/onboarding-store";

function App() {
  const { completed } = useOnboardingStore();

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
          <Route
            path="documentation"
            element={
              <div className="p-8 text-gray-500">
                Documentation — coming in Phase 4
              </div>
            }
          />
          <Route
            path="architecture"
            element={
              <div className="p-8 text-gray-500">
                Architecture — coming in Phase 4
              </div>
            }
          />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
