import Dexie, { type Table } from "dexie";
import type { FigmaCache, DriftException } from "../types/figma";
import type { ScanResult } from "../types/component";
import type { UsageImport } from "../types/usage";

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

/** Stores "intentional" decisions for Figma components with no code counterpart */
export interface FigmaOnlyDecision {
  id?: number;
  figmaCodeName: string;
  createdAt: string;
}

export interface ComponentStatus {
  parityStatus: string;
  a11yScore: number;
  usesTokens: boolean;
}

/** Lightweight score summary saved after each scan for trend tracking */
export interface ScanHistoryEntry {
  id?: number;
  timestamp: string;
  parityScore: number;
  parityGrade: string;
  coverageScore: number;
  a11yScore: number;
  tokenScore: number;
  totalComponents: number;
  alignedCount: number;
  issuesCount: number;
  componentStatuses?: Record<string, ComponentStatus>;
}

export interface VisualFlag {
  id?: number;
  componentName: string;
  note: string;
  flaggedBy: "designer" | "engineer";
  createdAt: string;
}

export class AuditDatabase extends Dexie {
  figmaCache!: Table<FigmaCache>;
  driftExceptions!: Table<DriftException>;
  scanResults!: Table<ScanResult & { id?: number }>;
  componentMappings!: Table<ComponentMapping>;
  noMatchDecisions!: Table<NoMatchDecision>;
  visualFlags!: Table<VisualFlag>;
  figmaOnlyDecisions!: Table<FigmaOnlyDecision>;
  scanHistory!: Table<ScanHistoryEntry>;
  usageImports!: Table<UsageImport>;

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

    // Version 4 adds visual inconsistency flags
    this.version(4).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
      noMatchDecisions: "++id, codeComponentName, reason",
      visualFlags: "++id, componentName, createdAt",
    });

    // Version 5 adds intentional decisions for Figma-only components
    this.version(5).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
      noMatchDecisions: "++id, codeComponentName, reason",
      visualFlags: "++id, componentName, createdAt",
      figmaOnlyDecisions: "++id, figmaCodeName",
    });

    // Version 6 adds scan history for trend tracking
    this.version(6).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
      noMatchDecisions: "++id, codeComponentName, reason",
      visualFlags: "++id, componentName, createdAt",
      figmaOnlyDecisions: "++id, figmaCodeName",
      scanHistory: "++id, timestamp",
    });

    // Version 7 adds tokenScore and componentStatuses to scan history
    this.version(7).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
      noMatchDecisions: "++id, codeComponentName, reason",
      visualFlags: "++id, componentName, createdAt",
      figmaOnlyDecisions: "++id, figmaCodeName",
      scanHistory: "++id, timestamp",
    });

    // Version 8 adds usage import table for component impact scoring
    this.version(8).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
      noMatchDecisions: "++id, codeComponentName, reason",
      visualFlags: "++id, componentName, createdAt",
      figmaOnlyDecisions: "++id, figmaCodeName",
      scanHistory: "++id, timestamp",
      usageImports: "++id, importedAt",
    });
  }
}

export const db = new AuditDatabase();
