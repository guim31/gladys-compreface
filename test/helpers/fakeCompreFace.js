// -----------------------------------------------------------------------------
// A simulated CompreFace server and IP cameras, behind one `fetch`.
//
// CompreFace (http://192.0.2.10:8000): every answer is one RECORDED from a
// real CompreFace 1.2.0 (test/fixtures/compreface): the subjects, the
// recognitions of real portraits (a known person, someone else, both, a
// landscape without a face), the key errors. `/faces` adds the subject, like
// CompreFace.
// Cameras (http://192.0.2.20/<name>.jpg): each serves a small JPEG standing
// for one recorded scene; `scene(name, sceneName)` changes what it "sees".
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { smallJpeg } from './jpeg.js';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/compreface/${name}.json`, import.meta.url), 'utf8'));

// What each scene gives, recorded with `Alice` known.
export const SCENES = {
  alice: fixture('recognize-known'),
  stranger: fixture('recognize-unknown'),
  two: fixture('recognize-two'),
  nobody: fixture('recognize-noface'),
  // Derived from `two`: the second face is Bob, known too, and the two
  // similarities cross from one picture to the other.
  couple: couple(0.9963, 0.95),
  coupleSwapped: couple(0.94, 0.97),
};

function couple(alice, bob) {
  const recorded = fixture('recognize-two');
  recorded.body.result[0].subjects = [{ subject: 'Alice', similarity: alice }];
  recorded.body.result[1].subjects = [{ subject: 'Bob', similarity: bob }];
  return recorded;
}

export const SERVER_URL = 'http://192.0.2.10:8000';
export const CAMERA_HOST = 'http://192.0.2.20';
export const API_KEY = '123e4567-e89b-42d3-a456-426614174000';

const json = ({ status, body }) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export class FakeCompreFace {
  constructor() {
    this.subjects = ['Alice'];
    this.down = false;
    this.requests = [];
    // camera name → { scene, bytes, auth?, down?, html? }
    this.cameras = new Map();
    this.byImage = new Map(); // base64 → scene name
    this.shade = 40;
    this.camera('front', 'alice');
    this.camera('garden', 'nobody');
    this.fetch = this.fetch.bind(this);
  }

  camera(name, scene, options = {}) {
    const bytes = smallJpeg(64, 36, (this.shade += 20));
    this.byImage.set(bytes.toString('base64'), scene);
    this.cameras.set(name, { scene, bytes, ...options });
    return `${CAMERA_HOST}/${name}.jpg`;
  }

  scene(name, scene) {
    const camera = this.cameras.get(name);
    camera.scene = scene;
    this.byImage.set(camera.bytes.toString('base64'), scene);
  }

  async fetch(input, init = {}) {
    const url = new URL(String(input));
    this.requests.push({
      url: url.toString(),
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body,
    });
    if (url.origin === new URL(SERVER_URL).origin) {
      if (this.down) {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
      }
      return this.server(url, init);
    }
    if (url.origin === CAMERA_HOST) {
      const camera = this.cameras.get(url.pathname.replace(/^\/|\.jpg$/g, ''));
      if (!camera || camera.down) {
        throw new TypeError('fetch failed', { cause: { code: 'EHOSTUNREACH' } });
      }
      if (
        camera.auth &&
        init.headers?.authorization !== `Basic ${Buffer.from(camera.auth).toString('base64')}`
      ) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (camera.html) {
        return new Response('<html>login</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      this.byImage.set(camera.bytes.toString('base64'), camera.scene);
      return new Response(camera.bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }
    throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  }

  server(url, init) {
    const key = init.headers?.['x-api-key'];
    if (!key) {
      return json(fixture('nokey'));
    }
    if (!/^[0-9a-f-]{36}$/.test(key)) {
      return json(fixture('badkey-format'));
    }
    if (key !== API_KEY) {
      // CompreFace writes the key it refuses in its message.
      const recorded = fixture('badkey-unknown');
      recorded.body.message = recorded.body.message.replace(/[0-9a-f-]{36}/, key);
      return json(recorded);
    }
    const path = url.pathname.replace('/api/v1/recognition', '');
    if (path === '/subjects' && (init.method ?? 'GET') === 'GET') {
      return json({ status: 200, body: { subjects: this.subjects } });
    }
    if (!['/recognize', '/faces'].includes(path) || init.method !== 'POST') {
      return json({ status: 404, body: { message: 'Not Found', code: 0 } });
    }
    const scene = this.byImage.get(JSON.parse(init.body).file) ?? 'nobody';
    const recorded = structuredClone(SCENES[scene]);
    if (recorded.status !== 200) {
      return json(recorded);
    }
    if (path === '/faces') {
      const subject = url.searchParams.get('subject');
      if (!this.subjects.includes(subject)) {
        this.subjects.push(subject);
      }
      return json({ status: 201, body: { ...fixture('add-face').body, subject } });
    }
    // Recorded with Alice known: a service that knows nobody returns no subject.
    for (const face of recorded.body.result) {
      face.subjects = face.subjects.filter((item) => this.subjects.includes(item.subject));
    }
    return json(recorded);
  }
}
