export type DriftReason =
  | "naming-convention"
  | "design-abstraction"
  | "pending-implementation"
  | "intentional-divergence";

export type AuditCategory =
  | "figma-parity"
  | "accessibility"
  | "tokens"
  | "documentation"
  | "architecture";

export interface FigmaVariant {
  name: string;
  properties: Record<string, string>;
}

export interface FigmaProperty {
  name: string;
  type: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "VARIANT";
  defaultValue?: string | boolean;
  variantOptions?: string[];
}

export interface FigmaComponent {
  id: string;
  name: string;
  /** Top-level name before the first "/" — used for code matching */
  codeName: string;
  description: string;
  key: string;
  variants: FigmaVariant[];
  properties: FigmaProperty[];
  documentation: string;
  lastModified: string;
  thumbnailUrl?: string;
}

export interface FigmaCache {
  id?: number;
  fileKey: string;
  fetchedAt: string;
  components: FigmaComponent[];
}

export interface DriftException {
  id?: number;
  componentName: string;
  category: AuditCategory;
  propertyName?: string;
  figmaValue?: string;
  codeValue?: string;
  reason: DriftReason;
  createdAt: string;
}

/** Raw shapes returned by the Figma REST API */
export interface FigmaApiComponent {
  key: string;
  name: string;
  description: string;
  node_id: string;
  thumbnail_url?: string;
  component_set_id?: string;
  updated_at?: string;
  containing_frame?: {
    name?: string;
  };
}

/** Response shape from GET /v1/files/:key/components */
export interface FigmaApiComponentsResponse {
  status: number;
  error: boolean;
  meta: {
    components: FigmaApiComponent[];
  };
}
