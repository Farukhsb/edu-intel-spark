export const formatMark = (mark: number | null) => (mark == null ? "-" : `${mark}%`);
export const formatPct = (value: number) => `${Math.round(value * 100)}%`;

export const hasInterventionLogged = (timestamp: string | null) => timestamp != null;

