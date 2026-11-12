/**
 * Type declarations for release provenance.
 */

/** Artifact evidence in a provenance record. */
export interface ProvenanceArtifact {
  path: string | null
  digest: string
  sourceCommit: string
  tested: "source" | "artifact"
  reproducible: boolean
}

/** One provenance record. */
export interface ProvenanceRecord {
  schema: number
  commit: string
  ref: string | null
  gate: string
  mapHash: string | null
  selection: "map" | "no-map"
  full: boolean
  groups: string[]
  fullRunId: string | null
  artifact: ProvenanceArtifact | null
  coverage: object | null
  coverageStatus: "provided" | "not-provided"
  acceptance: object | null
  acceptanceStatus: "provided" | "not-provided"
  startedAt: string
  finishedAt: string
  result: string
}

/** Verification result. */
export interface ProvenanceVerification {
  ok: boolean
  errors: Array<{ field: string; message: string }>
}

/** Compute a file digest. */
export declare function sha256File(path: string): string

/** Build a provenance record. */
export declare function createProvenanceRecord(input: {
  commit: string
  ref?: string | null
  gate: string
  mapHash: string | null
  groups?: string[]
  fullRunId?: string | null
  artifactPath?: string | null
  artifactDigest?: string | null
  sourceCommit?: string | null
  artifactTested?: "source" | "artifact"
  reproducible?: boolean
  coverage?: object | null
  acceptance?: object | null
  result?: string
  startedAt?: string
  finishedAt?: string
}): ProvenanceRecord

/** Verify a record against expected release facts. */
export declare function verifyProvenance(
  record: ProvenanceRecord,
  expected?: {
    commit?: string
    mapHash?: string
    artifactPath?: string
    artifactDigest?: string
  }
): ProvenanceVerification
