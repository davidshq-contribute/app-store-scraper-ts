/**
 * Represents version history information
 */
export interface VersionHistory {
  /** Version number */
  versionDisplay: string;
  /** Release date */
  releaseDate: string;
  /** Release notes */
  releaseNotes?: string;
}

/**
 * Represents privacy details
 */
export interface PrivacyDetails {
  /** Privacy policy URL */
  privacyPolicyUrl?: string;
  /** Privacy types (data collection categories) */
  privacyTypes?: PrivacyType[];
}

/**
 * Privacy data type category
 */
export interface PrivacyType {
  /** Privacy type identifier */
  privacyType: string;
  /** Human-readable privacy type name */
  name: string;
  /** Description of data collection */
  description: string;
  /** Data categories collected */
  dataCategories?: string[];
  /** Purposes for data collection */
  purposes?: string[];
}
