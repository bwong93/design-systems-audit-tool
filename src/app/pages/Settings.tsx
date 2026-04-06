import { Info } from "lucide-react";
import { useOnboardingStore } from "../../stores/onboarding-store";

export default function Settings() {
  const { figmaToken, figmaFileKey, nucleusPath, resetOnboarding } =
    useOnboardingStore();

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

        {/* Config */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Configuration</h2>
          <div className="space-y-3 text-sm">
            <ConfigRow label="Figma File Key" value={figmaFileKey || "—"} />
            <ConfigRow
              label="Figma Token"
              value={figmaToken ? "••••••••" + figmaToken.slice(-4) : "—"}
            />
            <ConfigRow label="Nucleus Path" value={nucleusPath || "—"} mono />
          </div>
          <button
            onClick={resetOnboarding}
            className="mt-4 text-xs text-red-500 hover:text-red-700"
          >
            Reset onboarding
          </button>
        </section>

        {/* Code Connect notice */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Tip: Figma Code Connect
              </h3>
              <p className="text-sm text-blue-700">
                Once Code Connect is configured in your Nucleus Figma file,
                mappings will be read automatically — no manual linking needed.
                Ask your Figma admin to set it up via the Figma CLI.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConfigRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
