import { ApifyClient } from 'apify-client';
import { AppError } from '../utils/AppError.js';

const DEFAULT_ACTOR = 'apify/google-search-scraper';
const MAX_RESULTS = 8;
const ACTOR_WAIT_SECS = 90;

export type ApifyWebHit = {
  title: string;
  url: string;
  description: string | null;
};

function extractOrganic(items: unknown[]): ApifyWebHit[] {
  const out: ApifyWebHit[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const directUrl = String(row.url ?? row.link ?? '').trim();
    const directTitle = String(row.title ?? '').trim();
    if (directUrl && directTitle && !row.organicResults) {
      if (seen.has(directUrl)) continue;
      seen.add(directUrl);
      const desc =
        typeof row.description === 'string'
          ? row.description.trim()
          : typeof row.snippet === 'string'
            ? row.snippet.trim()
            : null;
      out.push({
        title: directTitle.slice(0, 200),
        url: directUrl,
        description: desc ? desc.slice(0, 400) : null,
      });
      if (out.length >= MAX_RESULTS) return out;
      continue;
    }
    const organic = row.organicResults;
    if (!Array.isArray(organic)) continue;
    for (const r of organic) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      const url = String(o.url ?? o.link ?? '').trim();
      const title = String(o.title ?? '').trim();
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      const desc =
        typeof o.description === 'string'
          ? o.description.trim()
          : typeof o.snippet === 'string'
            ? o.snippet.trim()
            : null;
      out.push({
        title: title.slice(0, 200),
        url,
        description: desc ? desc.slice(0, 400) : null,
      });
      if (out.length >= MAX_RESULTS) return out;
    }
  }
  return out;
}

/**
 * Runs Apify Google Search Scraper once and returns normalized organic links.
 */
export async function runGoogleSearchViaApify(
  token: string,
  actorId: string,
  query: string,
): Promise<ApifyWebHit[]> {
  const q = query.trim().slice(0, 220);
  if (q.length < 4) {
    throw new AppError(400, 'Search query is too short');
  }

  const client = new ApifyClient({ token });

  const input = {
    queries: q,
    maxPagesPerQuery: 1,
    resultsPerPage: MAX_RESULTS + 2,
    perplexitySearch: {
      enablePerplexity: false,
      returnImages: false,
      returnRelatedQuestions: false,
    },
    chatGptSearch: { enableChatGpt: false },
    maximumLeadsEnrichmentRecords: 0,
  };

  let run;
  try {
    run = await client.actor(actorId).call(input, { waitSecs: ACTOR_WAIT_SECS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Apify run failed';
    throw new AppError(502, `Apify error: ${msg}`);
  }

  if (!run.defaultDatasetId) {
    throw new AppError(502, 'Apify run produced no dataset');
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const hits = extractOrganic(items);
  return hits;
}

export function defaultApifyActorId(envActor?: string): string {
  return (envActor?.trim() || DEFAULT_ACTOR).trim();
}
