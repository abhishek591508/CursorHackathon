import { createClient, parseStreamingResponse } from 'v0-sdk';
import { AppError } from '../utils/AppError.js';

const MAX_FILE_CHARS = 14_000;

type ChatLike = {
  webUrl: string;
  id?: string;
  latestVersion?: {
    status?: string;
    demoUrl?: string;
    files?: { name: string; content: string }[];
  };
};

function isChatDetail(x: unknown): x is ChatLike {
  return (
    typeof x === 'object' &&
    x !== null &&
    'webUrl' in x &&
    typeof (x as { webUrl?: unknown }).webUrl === 'string'
  );
}

function isReadableStream(x: unknown): x is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== 'undefined' && x instanceof ReadableStream;
}

/**
 * Sync create usually returns JSON; some API versions return an SSE stream instead.
 */
async function resolveChatsCreateResult(
  client: ReturnType<typeof createClient>,
  raw: unknown,
): Promise<ChatLike> {
  if (isChatDetail(raw)) {
    return raw;
  }

  if (!isReadableStream(raw)) {
    throw new AppError(
      502,
      'v0 returned an unexpected response shape (not a chat object or stream).',
    );
  }

  let lastChat: ChatLike | null = null;
  let chatId: string | null = null;

  try {
    for await (const ev of parseStreamingResponse(raw)) {
      if (!ev.data?.trim()) continue;
      try {
        const j = JSON.parse(ev.data) as Record<string, unknown>;
        if (typeof j.webUrl === 'string') {
          lastChat = j as unknown as ChatLike;
        }
        if (j.object === 'chat' && typeof j.id === 'string') {
          chatId = j.id;
          if (typeof j.webUrl === 'string') {
            lastChat = j as unknown as ChatLike;
          }
        }
        if (typeof j.chatId === 'string') {
          chatId = j.chatId;
        }
      } catch {
        /* non-JSON SSE payloads */
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stream read failed';
    throw new AppError(502, `v0 stream error: ${msg.slice(0, 200)}`);
  }

  if (lastChat && isChatDetail(lastChat)) {
    return lastChat;
  }

  if (chatId) {
    const refetched = await client.chats.getById({ chatId });
    if (isChatDetail(refetched)) {
      return refetched;
    }
  }

  throw new AppError(
    502,
    'v0 stream finished without a usable chat (no webUrl). Try again or check API key / plan.',
  );
}

/**
 * One-shot v0 Platform chat (sync) — returns links + generated file snippets.
 * Requires V0_API_KEY (https://v0.dev/chat/settings/keys).
 */
export async function runV0UiSketch(apiKey: string, userPrompt: string) {
  const client = createClient({ apiKey });
  const message =
    `${userPrompt.trim()}\n\n` +
    'Constraints: Next.js App Router, React 19, TypeScript, Tailwind CSS. ' +
    'Match a civic dashboard look: slate-900/950 backgrounds, emerald accents, readable contrast. ' +
    'Export as a small set of files (components only unless a page is explicitly requested).';

  let raw: unknown;
  try {
    raw = await client.chats.create({
      message,
      responseMode: 'sync',
      chatPrivacy: 'private',
      system:
        'You are v0 building UI for CivicPulse, a local civic issue app. Prefer accessible, mobile-first layouts.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'v0 request failed';
    throw new AppError(502, `v0 error: ${msg.slice(0, 400)}`);
  }

  const chat = await resolveChatsCreateResult(client, raw);

  const files =
    chat.latestVersion?.files?.map((f) => ({
      name: f.name,
      content:
        f.content.length > MAX_FILE_CHARS
          ? `${f.content.slice(0, MAX_FILE_CHARS)}\n\n/* …truncated for API response */`
          : f.content,
    })) ?? [];

  return {
    webUrl: chat.webUrl,
    demoUrl: chat.latestVersion?.demoUrl ?? null,
    versionStatus: chat.latestVersion?.status ?? null,
    files,
  };
}
