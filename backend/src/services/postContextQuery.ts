/**
 * Build a single-line web search query from a civic post (Apify / Exa).
 */
export function buildQueryFromPost(input: {
  title: string;
  issueTags?: string[];
  districtKey?: string | null;
  villageLabel?: string | null;
  placeLabel?: string | null;
}): string {
  const parts: string[] = [];
  const t = input.title.trim().slice(0, 100);
  if (t) parts.push(t);
  const tags = (input.issueTags ?? []).slice(0, 5).map((x) => String(x).trim());
  if (tags.length) parts.push(tags.join(' '));
  if (input.districtKey?.trim()) {
    parts.push(input.districtKey.replace(/-/g, ' '));
  }
  if (input.villageLabel?.trim()) {
    parts.push(input.villageLabel.trim().slice(0, 50));
  }
  if (input.placeLabel?.trim()) {
    parts.push(input.placeLabel.trim().slice(0, 50));
  }
  return parts.join(' ').trim().slice(0, 220);
}
