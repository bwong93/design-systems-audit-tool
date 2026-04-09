export interface ComponentUsage {
  component: string;
  repos: { name: string; instances: number }[];
  totalInstances: number;
  repoCount: number;
}

export interface UsageImport {
  id?: number;
  importedAt: string;
  totalRepos: number;
  components: ComponentUsage[];
}

export interface ComponentImpact {
  componentName: string;
  reachScore: number;
  qualityScore: number;
  impactScore: number;
  repoCount: number;
  totalInstances: number;
  repoList: { name: string; instances: number }[];
  needsAttention: boolean;
}
