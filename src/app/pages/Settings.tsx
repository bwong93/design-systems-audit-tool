import { useState, useEffect } from "react";
import {
  Link2,
  Trash2,
  CheckCircle,
  Search,
  RefreshCw,
  Info,
} from "lucide-react";
import { db, type ComponentMapping } from "../../services/db";
import { useAuditStore } from "../../stores/audit-store";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { runParityCheck } from "../../services/parity-checker";

export default function Settings() {
  const { results, figmaComponents, parityReport } = useAuditStore();
  const { figmaToken, figmaFileKey, nucleusPath, resetOnboarding } =
    useOnboardingStore();

  const [mappings, setMappings] = useState<ComponentMapping[]>([]);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);

  useEffect(() => {
    db.componentMappings.toArray().then(setMappings);
  }, []);

  const figmaNames = figmaComponents.map((f) => f.name).sort();
  const codeComponents = results?.components ?? [];
  const filteredComponents = codeComponents.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const getMappedFigmaName = (codeName: string) =>
    mappings.find(
      (m) => m.codeComponentName.toLowerCase() === codeName.toLowerCase(),
    )?.figmaComponentName ?? null;

  const handleSaveMapping = async (codeName: string) => {
    const figmaName = pending[codeName];

    await db.componentMappings
      .where("codeComponentName")
      .equalsIgnoreCase(codeName)
      .delete();

    if (figmaName) {
      await db.componentMappings.add({
        codeComponentName: codeName,
        figmaComponentName: figmaName,
        createdAt: new Date().toISOString(),
      });
    }

    const updated = await db.componentMappings.toArray();
    setMappings(updated);
    setPending((p) => {
      const next = { ...p };
      delete next[codeName];
      return next;
    });
    setSaved(codeName);
    setTimeout(() => setSaved(null), 2000);
  };

  const handleRemoveMapping = async (codeName: string) => {
    await db.componentMappings
      .where("codeComponentName")
      .equalsIgnoreCase(codeName)
      .delete();
    setMappings(await db.componentMappings.toArray());
  };

  const handleRerunParity = async () => {
    if (!results || !figmaComponents.length) return;
    setIsRerunning(true);
    try {
      const report = await runParityCheck(results.components, figmaComponents);
      // Update parity report in audit store directly
      useAuditStore.setState({ parityReport: report });
    } finally {
      setIsRerunning(false);
    }
  };

  const unmappedCount = codeComponents.filter(
    (c) => !getMappedFigmaName(c.name),
  ).length;

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

        {/* Component Mappings */}
        <section className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Component Mappings
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Explicitly link code components to their Figma counterparts.
                  Mapped components take priority over fuzzy matching.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  {mappings.length} mapped · {unmappedCount} unmatched
                </span>
                {parityReport && (
                  <button
                    onClick={handleRerunParity}
                    disabled={
                      isRerunning || !results || !figmaComponents.length
                    }
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
                    title="Re-run parity check with current mappings"
                  >
                    <RefreshCw
                      size={12}
                      className={isRerunning ? "animate-spin" : ""}
                    />
                    {isRerunning ? "Re-running..." : "Re-run parity"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {codeComponents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Run an audit from the Dashboard first to see components.
            </div>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-gray-100">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search components..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredComponents.map((c) => {
                  const currentMapping = getMappedFigmaName(c.name);
                  const pendingValue = pending[c.name];
                  const isDirty = pendingValue !== undefined;
                  const isSaved = saved === c.name;

                  return (
                    <div
                      key={c.name}
                      className="px-6 py-3 flex items-center gap-4"
                    >
                      <div className="w-44 shrink-0">
                        <p className="text-sm font-medium text-gray-900">
                          {c.name}
                        </p>
                        <p className="text-xs text-gray-400">code</p>
                      </div>

                      <Link2 size={14} className="text-gray-300 shrink-0" />

                      <div className="flex-1 min-w-0">
                        <select
                          value={pendingValue ?? currentMapping ?? ""}
                          onChange={(e) =>
                            setPending((p) => ({
                              ...p,
                              [c.name]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        >
                          <option value="">— Auto (fuzzy match) —</option>
                          {figmaNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-20 justify-end">
                        {isSaved && (
                          <CheckCircle size={16} className="text-green-500" />
                        )}
                        {isDirty && !isSaved && (
                          <button
                            onClick={() => handleSaveMapping(c.name)}
                            className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                          >
                            Save
                          </button>
                        )}
                        {currentMapping && !isDirty && (
                          <button
                            onClick={() => handleRemoveMapping(c.name)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Remove mapping"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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
