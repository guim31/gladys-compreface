// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Cameras come in four numbered slots (`camera_<n>_…`): the configuration form
// of Gladys has no list field. The slot number is the camera's identity in
// Gladys (its external id), whatever its name or address.
// -----------------------------------------------------------------------------

import { parseServerUrl } from './compreface.js';
import { parseCameraUrl } from './snapshot.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Seconds between two analyses of each camera (`interval`); 0 = on demand
// only (scene action, widget button, the image asked by Gladys).
export const INTERVALS = [0, 5, 10, 30, 60, 300, 900];

// Minimum similarity, in percent, for a face to be a known person; below, the
// face is an unknown one.
export const SIMILARITIES = [70, 75, 80, 85, 90, 95];

// Minimum probability, in percent, for a box to be a face at all.
export const DETECTIONS = [50, 70, 80, 90];

export const CAMERA_SLOTS = [1, 2, 3, 4];

export const DEFAULT_CONFIG = {
  url: '',
  similarity: '85',
  detection: '80',
  interval: '30',
  language: 'fr',
  ...Object.fromEntries(
    CAMERA_SLOTS.flatMap((slot) => [
      [`camera_${slot}_name`, ''],
      [`camera_${slot}_url`, ''],
    ]),
  ),
};

function pick(value, allowed, fallback) {
  const number = Number(value);
  return allowed.includes(number) ? number : Number(fallback);
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const read = (key) => (source[key] === undefined ? DEFAULT_CONFIG[key] : source[key]);
  const url = text(read('url'));
  const cameras = [];
  for (const slot of CAMERA_SLOTS) {
    const cameraUrl = text(source[`camera_${slot}_url`]);
    if (!cameraUrl) {
      continue;
    }
    cameras.push({
      slot,
      name: text(source[`camera_${slot}_name`]).slice(0, 80) || `Camera ${slot}`,
      url: cameraUrl,
      validUrl: Boolean(parseCameraUrl(cameraUrl)),
    });
  }
  return {
    url,
    validUrl: Boolean(parseServerUrl(url)),
    apiKey: text(source.api_key),
    similarity: pick(read('similarity'), SIMILARITIES, DEFAULT_CONFIG.similarity),
    detection: pick(read('detection'), DETECTIONS, DEFAULT_CONFIG.detection),
    intervalSeconds: pick(read('interval'), INTERVALS, DEFAULT_CONFIG.interval),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    cameras,
  };
}
