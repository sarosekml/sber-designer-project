export const problemZoneTypes = ['Green Zone', 'Watchlist', 'Red Zone', 'Black Zone'];

export type ProblemZoneType = (typeof problemZoneTypes)[number];

export interface ClientRiskMetrics {
  problemZone?: ProblemZoneType;
  rating?: string;
}
