import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useOnboardingStore } from "../../stores/onboarding-store";
import { useAuditStore } from "../../stores/audit-store";

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [token, setToken] = useState("");
  const [fileKey, setFileKey] = useState("");

  const {
    figmaConnected,
    nucleusValid,
    nucleusPath,
    isTestingFigma,
    isValidatingPath,
    figmaError,
    pathError,
    setFigmaCredentials,
    testFigmaConnection,
    setNucleusPath,
    validatePath,
    completeOnboarding,
  } = useOnboardingStore();

  const { startScan, isScanning } = useAuditStore();

  const handleTestFigma = async () => {
    setFigmaCredentials(token, fileKey);
    const ok = await testFigmaConnection();
    if (ok) setActiveStep(2);
  };

  const handleValidatePath = async () => {
    const ok = await validatePath();
    if (ok) setActiveStep(3);
  };

  const handleFirstScan = async () => {
    completeOnboarding();
    await startScan();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to DS Audit Tool
          </h1>
          <p className="text-gray-500 mt-1">
            Get set up in 3 steps — takes about 2 minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {/* Step 1 */}
          <StepCard
            step={1}
            title="Connect Figma"
            description="Enter your Personal Access Token and File Key."
            status={
              figmaConnected
                ? "complete"
                : activeStep === 1
                  ? "active"
                  : "locked"
            }
          >
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  placeholder="figd_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="mt-2 space-y-1.5">
                  <a
                    href="https://www.figma.com/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                  >
                    Get your token from Figma Settings{" "}
                    <ExternalLink size={11} />
                  </a>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1.5">
                      Required scopes — set all to <strong>Read only</strong>:
                    </p>
                    <ul className="text-xs text-gray-500 space-y-0.5">
                      <li>
                        ·{" "}
                        <code className="text-gray-700">file_content:read</code>{" "}
                        — Files section
                      </li>
                      <li>
                        ·{" "}
                        <code className="text-gray-700">
                          file_dev_resources:read
                        </code>{" "}
                        — Development section
                      </li>
                      <li>
                        ·{" "}
                        <code className="text-gray-700">
                          library_assets:read
                        </code>{" "}
                        — Design systems section
                      </li>
                      <li>
                        ·{" "}
                        <code className="text-gray-700">
                          library_content:read
                        </code>{" "}
                        — Design systems section
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Key
                </label>
                <input
                  type="text"
                  placeholder="jU08BKiiI2iegYajq41e2W"
                  value={fileKey}
                  onChange={(e) => setFileKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Found in your Figma URL: figma.com/design/
                  <strong>FILE_KEY</strong>/...
                </p>
              </div>

              {figmaError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {figmaError}
                </div>
              )}

              <button
                onClick={handleTestFigma}
                disabled={isTestingFigma || !token || !fileKey}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTestingFigma ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ChevronRight size={16} />
                )}
                {isTestingFigma ? "Testing connection..." : "Test Connection"}
              </button>
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard
            step={2}
            title="Confirm Nucleus Path"
            description="Verify the path to your local Nucleus repository."
            status={
              nucleusValid ? "complete" : activeStep === 2 ? "active" : "locked"
            }
          >
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nucleus root directory
                </label>
                <input
                  type="text"
                  value={nucleusPath}
                  onChange={(e) => setNucleusPath(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {pathError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {pathError}
                </div>
              )}

              <button
                onClick={handleValidatePath}
                disabled={isValidatingPath || !nucleusPath}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isValidatingPath ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ChevronRight size={16} />
                )}
                {isValidatingPath ? "Checking..." : "Confirm Path"}
              </button>
            </div>
          </StepCard>

          {/* Step 3 */}
          <StepCard
            step={3}
            title="Run Your First Audit"
            description="Scan Nucleus and compare with your Figma library."
            status={activeStep === 3 ? "active" : "locked"}
          >
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-4">
                This will scan all components in Nucleus, fetch your Figma
                library, and generate your first parity report. Takes about 20
                seconds.
              </p>
              <button
                onClick={handleFirstScan}
                disabled={isScanning}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isScanning ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ChevronRight size={16} />
                )}
                {isScanning ? "Running audit..." : "Start First Audit"}
              </button>
            </div>
          </StepCard>
        </div>
      </div>
    </div>
  );
}

type StepStatus = "complete" | "active" | "locked";

function StepCard({
  step,
  title,
  description,
  status,
  children,
}: {
  step: number;
  title: string;
  description: string;
  status: StepStatus;
  children?: React.ReactNode;
}) {
  const isLocked = status === "locked";

  return (
    <div
      className={`bg-white rounded-lg border p-5 transition-all ${
        isLocked
          ? "border-gray-200 opacity-50"
          : status === "complete"
            ? "border-green-200 bg-green-50"
            : "border-primary-200 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {status === "complete" ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <Circle
              size={20}
              className={
                status === "active" ? "text-primary-500" : "text-gray-300"
              }
            />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Step {step}
            </span>
            {status === "complete" && (
              <span className="text-xs text-green-600 font-medium">
                Complete
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 mt-0.5">{title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          {status !== "locked" && children}
        </div>
      </div>
    </div>
  );
}
