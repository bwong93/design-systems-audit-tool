import Dexie, { type Table } from "dexie";
import type { FigmaCache, DriftException } from "../types/figma";
import type { ScanResult } from "../types/component";

export interface ComponentMapping {
  id?: number;
  codeComponentName: string;
  figmaComponentName: string;
  figmaNodeId?: string;
  createdAt: string;
}

/** Stores explicit "no match" decisions so they survive re-scans */
export interface NoMatchDecision {
  id?: number;
  codeComponentName: string;
  /** gap = genuine missing component needing work; intentional = by design (no Figma spec needed) */
  reason: "gap" | "intentional";
  createdAt: string;
}

export class AuditDatabase extends Dexie {
  figmaCache!: Table<FigmaCache>;
  driftExceptions!: Table<DriftException>;
  scanResults!: Table<ScanResult & { id?: number }>;
  componentMappings!: Table<ComponentMapping>;
  noMatchDecisions!: Table<NoMatchDecision>;

  constructor() {
    super("ds-audit-tool");

    this.version(1).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
    });

    this.version(2).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
    });

    // Version 3 adds no-match decisions
    this.version(3).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
      noMatchDecisions: "++id, codeComponentName, reason",
    });
  }
}

export const db = new AuditDatabase();
