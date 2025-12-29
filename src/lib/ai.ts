export type ImageValidationResult = { ok: true } | { ok: false; reason?: string }

function timeoutFetch(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 10000, ...rest } = init
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...rest, signal: controller.signal }).finally(() => clearTimeout(id))
}

export async function validateImageMatchesDescription(file: File, description: string): Promise<ImageValidationResult> {
  const key = import.meta.env.VITE_HF_API_KEY as string | undefined
  if (!key) {
    return { ok: true }
  }

  try {
    const res = await timeoutFetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'Content-Type': 'application/octet-stream',
        },
        body: file,
        timeoutMs: 12000,
      },
    )

    if (!res.ok) {
      return { ok: true }
    }

    const data = (await res.json()) as Array<{ generated_text?: string }>
    const caption = data?.[0]?.generated_text?.toLowerCase() || ''
    if (!caption) return { ok: true }

    const desc = (description || '').toLowerCase()
    const tokens = Array.from(
      new Set(
        desc
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
      ),
    )

    const capTokens = new Set(
      caption
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 4),
    )

    let overlap = 0
    for (const t of tokens) if (capTokens.has(t)) overlap++

    if (tokens.length >= 4 && overlap === 0) {
      return { ok: false, reason: 'The image may not match the description provided.' }
    }

    return { ok: true }
  } catch {
    return { ok: true }
  }
}

const STOPWORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'near',
  'very',
  'this',
  'that',
  'there',
  'issue',
  'problem',
  'please',
  'help',
  'have',
  'been',
  'area',
  'city',
  'road',
  'street',
  'local',
  'nearby',
])
