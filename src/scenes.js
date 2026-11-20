// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// `analyze`: analyze one camera now, e.g. when the doorbell rings or a door
// opens, and hand who CompreFace saw to the next actions of the scene (a
// condition on `recognized` or `person`, the names in a message). The camera
// image is updated too, so the core's "Send a camera image" action that
// follows sends that very picture. No scene event is fired from here (no loop).
// -----------------------------------------------------------------------------

import { resultText } from './devices.js';

async function analyze(monitor, { fields }) {
  const camera = monitor.require(fields?.camera);
  const summary = await monitor.analyze(camera, { events: false });
  return {
    recognized: summary.known.length > 0,
    person: summary.known[0]?.name ?? '',
    people: summary.known.map((person) => person.name).join(', '),
    similarity: summary.known[0]?.similarity ?? 0,
    unknown: summary.unknown,
    faces: summary.faces,
    result: resultText(summary, monitor.config.language),
  };
}

export const SCENE_ACTIONS = { analyze };
