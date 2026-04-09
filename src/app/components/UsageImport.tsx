import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuditStore } from "../../stores/audit-store";

export default function UsageImport() {
  const { usageData, importUsageData } = useAuditStore();
  const [showUpload, setShowUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setSuccess(false);
    try {
      const text = await file.text();
      const result = await importUsageData(text);
      setWarnings(result.warnings);
      setSuccess(true);
      setShowUpload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (usageData && !showUpload) {
    const importedDate = new Date(usageData.importedAt).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" },
    );

    return (
      <div className="space-y-3">
        {success && warnings.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle
              size={14}
              className="text-amber-500 mt-0.5 shrink-0"
            />
            <div className="space-y-1">
              {warnings.map((w) => (
                <p key={w} className="text-xs text-amber-700">
                  {w}
                </p>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle size={16} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">
                Last imported {importedDate}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {usageData.components.length} components tracked across{" "}
                {usageData.totalRepos} repo
                {usageData.totalRepos !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowUpload(true);
              setSuccess(false);
              setWarnings([]);
              setError(null);
            }}
            className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium transition-colors"
          >
            <RefreshCw size={12} />
            Replace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file — click or drag and drop"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-lg px-6 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
          isDragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-200 hover:border-gray-300 bg-gray-50"
        } ${isLoading ? "pointer-events-none opacity-60" : ""}`}
      >
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <Upload size={20} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {isLoading ? "Importing…" : "Drop a CSV file here"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLoading ? "Please wait" : "or click to browse"}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {success && warnings.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            {warnings.map((w) => (
              <p key={w} className="text-xs text-amber-700">
                {w}
              </p>
            ))}
          </div>
        </div>
      )}

      {showUpload && (
        <button
          onClick={() => setShowUpload(false)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
