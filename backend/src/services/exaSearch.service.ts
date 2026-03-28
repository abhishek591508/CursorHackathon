import { AppError } from '../utils/AppError.js';

export type ExaWebHit = {
  title: string;
  url: string;
  description: string | null;
};

type ExaResultRow = {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
};

/**
 * Semantic / hybrid web search via Exa (https://exa.ai).
 */
export async function runExaSearch(
  apiKey: string,
  query: string,
): Promise<ExaWebHit[]> {
  const q = query.trim().slice(0, 220);
  if (q.length < 4) {
    throw new AppError(400, 'Search query is too short');
  }

  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query: q,
      type: 'auto',
      numResults: 8,
      contents: {
        text: { maxCharacters: 280 },
      },
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new AppError(
      502,
      `Exa error (${res.status}): ${rawText.slice(0, 240)}`,
    );
  }

  let data: { results?: ExaResultRow[] };
  try {
    data = JSON.parse(rawText) as { results?: ExaResultRow[] };
  } catch {
    throw new AppError(502, 'Exa returned invalid JSON');
  }

  const rows = Array.isArray(data.results) ? data.results : [];
  const out: ExaWebHit[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const url = String(r.url ?? '').trim();
    const title = String(r.title ?? '').trim() || url || 'Untitled';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    const hl = Array.isArray(r.highlights)
      ? r.highlights.filter((h): h is string => typeof h === 'string').join(' ').trim()
      : '';
    const blurb = text || hl;
    out.push({
      title: title.slice(0, 200),
      url,
      description: blurb ? blurb.slice(0, 400) : null,
    });
    if (out.length >= 8) break;
  }

  return out;
}
