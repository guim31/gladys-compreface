// -----------------------------------------------------------------------------
// What a watched camera becomes in Gladys: one device per camera slot, with
//   - `image` (`camera/image`): the last analyzed picture;
//   - `person` (`text/text`): the last known person recognized, kept until
//     another one is;
//   - `similarity` (`counter-sensor/integer`, 0-100 %): how sure CompreFace
//     was of that person;
//   - `recognized-at` (`text/text`): when that person was last recognized;
//   - `known` (`presence-sensor/binary`): a known person is in the picture of
//     the last analysis (1 = yes);
//   - `unknown` (`motion-sensor/binary`): a face nobody knows is in it (1 =
//     detected, like every Gladys detector);
//   - `faces` (`counter-sensor/integer`, 0-20): how many faces in it.
// Feature keys are forever: they are part of the external ids.
// -----------------------------------------------------------------------------

export const DEVICE_TYPE = 'camera';

export const FEATURE_KEYS = {
  IMAGE: 'image',
  PERSON: 'person',
  SIMILARITY: 'similarity',
  RECOGNIZED_AT: 'recognized-at',
  KNOWN: 'known',
  UNKNOWN: 'unknown',
  FACES: 'faces',
};

// Bounds of the face count: more is shown as 20.
export const MAX_FACES = 20;

// Feature names, frozen when the user adds the device.
export const NAMES = {
  en: {
    image: 'Image',
    person: 'Last person recognized',
    similarity: 'Similarity (%)',
    recognizedAt: 'Recognized at',
    known: 'Known person',
    unknown: 'Unknown face',
    faces: 'Faces',
    none: 'Nobody',
    unknownFaces: (count) => (count > 1 ? `${count} unknown faces` : 'Unknown face'),
  },
  fr: {
    image: 'Image',
    person: 'Dernière personne reconnue',
    similarity: 'Similarité (%)',
    recognizedAt: 'Reconnue le',
    known: 'Personne connue',
    unknown: 'Visage inconnu',
    faces: 'Visages',
    none: 'Personne',
    unknownFaces: (count) => (count > 1 ? `${count} visages inconnus` : 'Visage inconnu'),
  },
  de: {
    image: 'Bild',
    person: 'Zuletzt erkannte Person',
    similarity: 'Ähnlichkeit (%)',
    recognizedAt: 'Erkannt am',
    known: 'Bekannte Person',
    unknown: 'Unbekanntes Gesicht',
    faces: 'Gesichter',
    none: 'Niemand',
    unknownFaces: (count) => (count > 1 ? `${count} unbekannte Gesichter` : 'Unbekanntes Gesicht'),
  },
  es: {
    image: 'Imagen',
    person: 'Última persona reconocida',
    similarity: 'Similitud (%)',
    recognizedAt: 'Reconocida el',
    known: 'Persona conocida',
    unknown: 'Rostro desconocido',
    faces: 'Rostros',
    none: 'Nadie',
    unknownFaces: (count) => (count > 1 ? `${count} rostros desconocidos` : 'Rostro desconocido'),
  },
};

export const namesFor = (language) => NAMES[language] ?? NAMES.en;

/** The ids of one camera: its slot number, the one stable thing about it. */
export function deviceIds(gladys, slot) {
  return gladys.externalIds(DEVICE_TYPE, String(slot));
}

/** The slot behind a device external id (`compreface:camera:2`), or null. */
export function slotOf(externalId) {
  const match = /:(\d+)$/.exec(String(externalId ?? ''));
  return match ? Number(match[1]) : null;
}

const feature = (key, category, type, name, min, max, keepHistory = true) => ({
  key,
  category,
  type,
  name,
  min,
  max,
  read_only: true,
  has_feedback: key !== FEATURE_KEYS.IMAGE,
  keep_history: keepHistory,
});

export function featureSpecs(language) {
  const names = namesFor(language);
  return [
    feature(FEATURE_KEYS.IMAGE, 'camera', 'image', names.image, 0, 0, false),
    feature(FEATURE_KEYS.PERSON, 'text', 'text', names.person, 0, 0),
    feature(FEATURE_KEYS.SIMILARITY, 'counter-sensor', 'integer', names.similarity, 0, 100),
    feature(FEATURE_KEYS.RECOGNIZED_AT, 'text', 'text', names.recognizedAt, 0, 0, false),
    feature(FEATURE_KEYS.KNOWN, 'presence-sensor', 'binary', names.known, 0, 1),
    feature(FEATURE_KEYS.UNKNOWN, 'motion-sensor', 'binary', names.unknown, 0, 1),
    feature(FEATURE_KEYS.FACES, 'counter-sensor', 'integer', names.faces, 0, MAX_FACES),
  ];
}

export function buildDevice(gladys, camera, language) {
  const ids = deviceIds(gladys, camera.slot);
  return {
    name: camera.name,
    external_id: ids.device,
    model: 'CompreFace',
    // The analyses run on the integration's own timer (the interval chosen
    // in the configuration): the Gladys scheduler has no use here.
    should_poll: false,
    params: [{ name: 'COMPREFACE_CAMERA_SLOT', value: String(camera.slot) }],
    features: featureSpecs(language).map(({ key, ...spec }) => ({
      ...spec,
      external_id: ids.feature(key),
    })),
  };
}

/**
 * What the faces of one picture mean: the known people (best similarity
 * each, the most similar first), the unknown faces, the text of a result.
 * @param {Array<{ subject: string|null, similarity: number }>} faces as
 *   returned by CompreFaceClient.recognize (similarity 0-1)
 * @param {number} threshold minimum similarity of a known person, in percent
 */
export function summarize(faces, threshold) {
  const best = new Map();
  let unknown = 0;
  for (const face of faces) {
    const percent = Math.round(face.similarity * 100);
    if (!face.subject || percent < threshold) {
      unknown += 1;
      continue;
    }
    best.set(face.subject, Math.max(best.get(face.subject) ?? 0, percent));
  }
  const known = [...best.entries()]
    .map(([name, similarity]) => ({ name, similarity }))
    .sort((a, b) => b.similarity - a.similarity || a.name.localeCompare(b.name));
  return { faces: faces.length, known, unknown };
}

/** The result of an analysis in words ("Alice (97 %), 1 unknown face", "Nobody"). */
export function resultText(summary, language) {
  const names = namesFor(language);
  const parts = summary.known.map((person) => `${person.name} (${person.similarity} %)`);
  if (summary.unknown > 0) {
    parts.push(names.unknownFaces(summary.unknown));
  }
  const text = parts.length ? parts.join(', ') : names.none;
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/** A date and time in the language of the names, in the zone of Gladys (TZ). */
export function formatTime(at, language) {
  return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(at),
  );
}
