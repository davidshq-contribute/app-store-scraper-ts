/**
 * Represents a user review from the App Store
 */
export interface Review {
  /** Unique review ID */
  id: string;
  /** Review author username */
  userName: string;
  /** Author's iTunes URL */
  userUrl: string;
  /** App version this review is for */
  version: string;
  /**
   * Star rating. Valid values are 1–5. Use 0 to mean missing or invalid (unparseable
   * or absent in the feed); treat 0 as "no rating" in consumers.
   */
  score: number;
  /** Review title/headline */
  title: string;
  /** Review body text */
  text: string;
  /** Review submission date */
  updated: string;
}
