import type { ScanResult } from "../types/component";

export async function runScan(): Promise<ScanResult> {
  const res = await fetch("/api/scan");

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Scan failed (${res.status})`);
  }

  return res.json();
}

export async function validateNucleusPath(rootPath: string): Promise<boolean> {
  const res = await fetch(
    `/api/validate-path?path=${encodeURIComponent(rootPath)}`,
  );

  if (!res.ok) return false;

  const body = await res.json();
  return body.valid === true;
}
