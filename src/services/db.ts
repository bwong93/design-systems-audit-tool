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

export class AuditDatabase extends Dexie {
  figmaCache!: Table<FigmaCache>;
  driftExceptions!: Table<DriftException>;
  scanResults!: Table<ScanResult & { id?: number }>;
  componentMappings!: Table<ComponentMapping>;

  constructor() {
    super("ds-audit-tool");

    this.version(1).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
    });

    // Version 2 adds component mappings
    this.version(2).stores({
      figmaCache: "++id, fileKey, fetchedAt",
      driftExceptions: "++id, componentName, category, propertyName, createdAt",
      scanResults: "++id, timestamp",
      componentMappings: "++id, codeComponentName, figmaComponentName",
    });
  }
}

export const db = new AuditDatabase();
