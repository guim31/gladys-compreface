// -----------------------------------------------------------------------------
// CompreFace client (exadel-inc/CompreFace, its REST API, recognition
// service). Every call carries the key of a RECOGNITION service in the
// `x-api-key` header:
//   GET  /api/v1/recognition/subjects   the people (subjects) of the service;
//   POST /api/v1/recognition/recognize  { file: <base64> } → for each face
//        found, its box and the closest subjects with their similarity (0-1);
//   POST /api/v1/recognition/faces?subject=<name>  { file } → adds the face of
//        the picture as an example of that person (created if new).
// CompreFace answers errors as `{ message, code }` (recorded on 1.2.0, see
// test/fixtures/compreface): code 28 (HTTP 400) is "No face is found in the
// given image", also for bytes that are not an image: a result, not a
// failure. A key of no recognition service (a Detection key, a deleted
// service) is HTTP 404 code 10; a key that is not a UUID, 400 code 26; no key,
// 400 code 20.
// -----------------------------------------------------------------------------

export const DEFAULT_PORT = 8000;
// A CPU recognition takes about 0.5 s, but the very first one after
// CompreFace starts loads the models: 45 s measured. The whole request,
// image included, gets this long.
export const RECOGNIZE_TIMEOUT_MS = 60_000;
const LIST_TIMEOUT_MS = 8000;

// CompreFace error codes this client tells apart.
export const NO_FACE_CODE = 28;
const KEY_CODES = new Set([10, 20, 26]);

export class CompreFaceError extends Error {
  /**
   * @param {'unreachable'|'timeout'|'auth'|'image'|'http'|'format'} kind
   */
  constructor(kind, message) {
    super(message);
    this.name = 'CompreFaceError';
    this.kind = kind;
  }
}

/**
 * The base URL of a CompreFace server from what the user typed ("192.0.2.5",
 * "compreface.lan:8000", "https://faces.example/"), or null.
 */
export function parseServerUrl(text) {
  const value = String(text ?? '').trim();
  if (!value) {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // An explicit port, even the default one (`:80`), is kept: read it from the
  // authority without its user info (an IPv6 host holds colons too).
  const authority = withScheme.split('/')[2].replace(/^.*@/, '');
  if (!url.port && url.protocol === 'http:' && !/:\d+$/.test(authority)) {
    url.port = String(DEFAULT_PORT);
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

/** A subject name as CompreFace keeps it: trimmed, single spaces, 1 to 100 characters. */
export function cleanSubject(text) {
  const value = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return value && value.length <= 100 ? value : null;
}

const round = (value) => Math.round(value * 10000) / 10000;

export class CompreFaceClient {
  /**
   * @param {{ url: string, apiKey: string, fetch?: typeof fetch }} options
   */
  constructor({ url, apiKey, fetch: fetchImpl = globalThis.fetch }) {
    this.base = parseServerUrl(url);
    if (!this.base) {
      throw new CompreFaceError('format', 'Invalid CompreFace address');
    }
    this.apiKey = String(apiKey ?? '').trim();
    this.fetch = fetchImpl;
  }

  async request(path, { method = 'GET', body, timeoutMs }) {
    let response;
    try {
      response = await this.fetch(`${this.base}/api/v1/recognition${path}`, {
        method,
        headers: {
          'x-api-key': this.apiKey,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new CompreFaceError(
          'timeout',
          `CompreFace did not answer within ${timeoutMs / 1000} s`,
        );
      }
      throw new CompreFaceError(
        'unreachable',
        `CompreFace is unreachable (${err?.cause?.code ?? err?.message})`,
      );
    }
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const code = Number(data?.code);
      const message = typeof data?.message === 'string' ? data.message.slice(0, 200) : '';
      if (code === NO_FACE_CODE) {
        return { result: [], noFace: true };
      }
      if (response.status === 401 || response.status === 403 || KEY_CODES.has(code)) {
        // Not the message: CompreFace writes the refused key in it.
        throw new CompreFaceError(
          'auth',
          `CompreFace refused the API key (code ${code || response.status})`,
        );
      }
      if (response.status === 400 && method === 'POST') {
        throw new CompreFaceError(
          'image',
          `CompreFace could not read the image${message ? `: ${message}` : ''}`,
        );
      }
      throw new CompreFaceError(
        'http',
        `CompreFace answered HTTP ${response.status}${message ? `: ${message}` : ''}`,
      );
    }
    if (!data || typeof data !== 'object') {
      throw new CompreFaceError(
        'format',
        'CompreFace did not answer JSON: is it the right address?',
      );
    }
    return data;
  }

  /** The names of the people the recognition service knows. */
  async subjects() {
    const data = await this.request('/subjects', { timeoutMs: LIST_TIMEOUT_MS });
    if (!Array.isArray(data.subjects)) {
      throw new CompreFaceError(
        'format',
        'CompreFace did not list its subjects: is it the right address?',
      );
    }
    return data.subjects.map((item) => String(item)).filter(Boolean);
  }

  /**
   * Recognize the faces of a picture.
   * @param {string} base64 the JPEG, in base64
   * @param {{ detection?: number }} [options] detection: the minimum
   *   probability (0-1) that a box is a face
   * @returns {Promise<Array<{ box: { x_min: number, y_min: number, x_max: number, y_max: number, probability: number },
   *   subject: string|null, similarity: number }>>} one entry per face, with
   *   its closest subject (null when the service knows nobody)
   */
  async recognize(base64, { detection = 0.8 } = {}) {
    const query = new URLSearchParams({
      limit: '0',
      prediction_count: '1',
      det_prob_threshold: String(detection),
    });
    const data = await this.request(`/recognize?${query}`, {
      method: 'POST',
      body: { file: base64 },
      timeoutMs: RECOGNIZE_TIMEOUT_MS,
    });
    if (!Array.isArray(data.result)) {
      throw new CompreFaceError('format', 'CompreFace did not answer a recognition result');
    }
    return data.result.map((face) => {
      const box = face?.box ?? {};
      const best = Array.isArray(face?.subjects) ? face.subjects[0] : null;
      const similarity = Number(best?.similarity);
      return {
        box: {
          x_min: Number(box.x_min) || 0,
          y_min: Number(box.y_min) || 0,
          x_max: Number(box.x_max) || 0,
          y_max: Number(box.y_max) || 0,
          probability: round(Number(box.probability) || 0),
        },
        subject: best && typeof best.subject === 'string' && best.subject ? best.subject : null,
        similarity: Number.isFinite(similarity) ? round(similarity) : 0,
      };
    });
  }

  /**
   * Add the face of a picture as an example of a person.
   * @returns {Promise<{ subject: string, imageId: string }|null>} null when
   *   the picture holds no face
   */
  async addFace(subject, base64, { detection = 0.8 } = {}) {
    const query = new URLSearchParams({ subject, det_prob_threshold: String(detection) });
    const data = await this.request(`/faces?${query}`, {
      method: 'POST',
      body: { file: base64 },
      timeoutMs: RECOGNIZE_TIMEOUT_MS,
    });
    if (data.noFace) {
      return null;
    }
    return { subject: String(data.subject ?? subject), imageId: String(data.image_id ?? '') };
  }
}
