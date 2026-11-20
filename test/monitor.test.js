// -----------------------------------------------------------------------------
// The monitor against the simulated CompreFace and cameras (test/helpers):
// states, images, scene events on appearance only, regular analyses for the
// added devices only, failures (camera, server, key), actions shown in red on
// failure, adding a face, the widget.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from '../src/config.js';
import { CompreFaceClient, CompreFaceError, parseServerUrl } from '../src/compreface.js';
import { resultText, summarize } from '../src/devices.js';
import { SnapshotError, fetchSnapshot, redact } from '../src/snapshot.js';
import {
  API_KEY,
  BASE_CONFIG,
  CAMERA_HOST,
  FakeCompreFace,
  createAll,
  createWorld,
} from './helpers/world.js';
import { SCENES } from './helpers/fakeCompreFace.js';

const ID = {
  front: 'ext:test-integration:camera:1',
  garden: 'ext:test-integration:camera:2',
};
const last = (world, id) => world.fake.lastState(id);
const text = (world, id) => {
  const state = world.fake.states.filter((item) => item.device_feature_external_id === id).pop();
  return state?.text;
};
const recognitions = (world) =>
  world.server.requests.filter((r) => r.url.includes('/recognize')).length;

test('configuration: slots, thresholds, defaults', () => {
  const config = normalizeConfig({
    ...BASE_CONFIG,
    similarity: '90',
    camera_3_url: '   ',
    camera_4_url: 'rtsp://192.0.2.30/stream',
  });
  assert.equal(config.intervalSeconds, 30);
  assert.equal(config.similarity, 90);
  assert.equal(config.detection, 80);
  assert.equal(config.apiKey, API_KEY);
  assert.deepEqual(
    config.cameras.map((camera) => [camera.slot, camera.validUrl]),
    [
      [1, true],
      [2, true],
      [4, false],
    ],
  );
  const defaults = normalizeConfig({});
  assert.equal(defaults.language, 'fr');
  assert.equal(defaults.validUrl, false);
  assert.equal(defaults.similarity, 85);
  assert.equal(normalizeConfig({ interval: '42', similarity: '12' }).similarity, 85);
});

test('addresses: CompreFace port 8000 by default, camera credentials never shown', () => {
  assert.equal(parseServerUrl('192.0.2.10'), 'http://192.0.2.10:8000');
  assert.equal(parseServerUrl('faces.lan:9000/'), 'http://faces.lan:9000');
  assert.equal(parseServerUrl('https://faces.example/'), 'https://faces.example');
  assert.equal(parseServerUrl('http://192.0.2.10:80'), 'http://192.0.2.10');
  assert.equal(parseServerUrl('ftp://x'), null);
  assert.equal(parseServerUrl(''), null);
  assert.equal(redact('http://admin:secret@192.0.2.30/snap.jpg'), 'http://192.0.2.30');
  assert.equal(redact('nope'), '(invalid address)');
});

test('the client sends what CompreFace expects and reads its recorded answers', async () => {
  const server = new FakeCompreFace();
  const client = new CompreFaceClient({ url: '192.0.2.10', apiKey: API_KEY, fetch: server.fetch });
  assert.deepEqual(await client.subjects(), ['Alice']);
  const front = server.cameras.get('front').bytes.toString('base64');
  server.scene('front', 'two');
  const faces = await client.recognize(front, { detection: 0.7 });
  assert.deepEqual(
    faces.map((face) => [face.subject, face.similarity]),
    [
      ['Alice', 0.9963],
      ['Alice', 0.2077],
    ],
  );
  const request = server.requests.at(-1);
  assert.equal(request.headers['x-api-key'], API_KEY);
  const query = new URL(request.url).searchParams;
  assert.equal(query.get('det_prob_threshold'), '0.7');
  assert.equal(query.get('prediction_count'), '1');
  assert.deepEqual(JSON.parse(request.body), { file: front });
  // No face (code 28): an empty result, not an error.
  server.scene('front', 'nobody');
  assert.deepEqual(await client.recognize(front), []);
  assert.equal(await client.addFace('Bob', front), null);
  // The key errors recorded on CompreFace 1.2.0.
  for (const apiKey of ['', 'nope', '00000000-0000-0000-0000-000000000000']) {
    const wrong = new CompreFaceClient({ url: '192.0.2.10', apiKey, fetch: server.fetch });
    await assert.rejects(
      wrong.subjects(),
      (err) => err instanceof CompreFaceError && err.kind === 'auth',
    );
  }
  server.down = true;
  await assert.rejects(client.subjects(), (err) => err.kind === 'unreachable');
});

test('summary: known people above the threshold, the others unknown', () => {
  const faces = (scene) =>
    SCENES[scene].body.result?.map((face) => ({
      subject: face.subjects[0]?.subject ?? null,
      similarity: face.subjects[0]?.similarity ?? 0,
    })) ?? [];
  const two = summarize(faces('two'), 85);
  assert.deepEqual(two, { faces: 2, known: [{ name: 'Alice', similarity: 100 }], unknown: 1 });
  assert.equal(resultText(two, 'fr'), 'Alice (100 %), Visage inconnu');
  assert.equal(resultText(summarize(faces('stranger'), 85), 'de'), 'Unbekanntes Gesicht');
  assert.equal(resultText(summarize([], 85), 'es'), 'Nadie');
  // Similarity 0.21: a known person only below a (silly) 20 % threshold.
  assert.equal(summarize(faces('stranger'), 20).known.length, 1);
});

test('a snapshot URL with credentials becomes a Basic header; a page is not an image', async () => {
  const server = new FakeCompreFace();
  server.camera('locked', 'alice', { auth: 'admin:p@ss' });
  const bytes = await fetchSnapshot(new URL(`http://admin:p%40ss@192.0.2.20/locked.jpg`), {
    fetch: server.fetch,
  });
  assert.equal(bytes[0], 0xff);
  assert.equal(
    server.requests.at(-1).url,
    `${CAMERA_HOST}/locked.jpg`,
    'no credentials in the URL',
  );
  await assert.rejects(
    fetchSnapshot(new URL(`${CAMERA_HOST}/locked.jpg`), { fetch: server.fetch }),
    (err) => err instanceof SnapshotError && err.kind === 'auth',
  );
  server.camera('portal', 'alice', { html: true });
  await assert.rejects(
    fetchSnapshot(new URL(`${CAMERA_HOST}/portal.jpg`), { fetch: server.fetch }),
    (err) => err.kind === 'format',
  );
});

test('connected: the devices are published and the status is green', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  assert.deepEqual(
    world.fake.discoveredDevices.map((device) => device.external_id),
    [ID.front, ID.garden],
  );
  // Nothing is analyzed before the user adds a device.
  await world.monitor.tick();
  assert.equal(recognitions(world), 0);
});

test('adding a device analyzes it and sends every state, the image and the badge', async (t) => {
  const world = await createWorld({ config: { ...BASE_CONFIG, language: 'fr' } });
  t.after(() => world.app.stop());
  await createAll(world);
  assert.equal(text(world, `${ID.front}:person`), 'Alice');
  assert.equal(last(world, `${ID.front}:similarity`), 99);
  assert.equal(text(world, `${ID.front}:recognized-at`), '16/11/2026 12:00');
  assert.equal(last(world, `${ID.front}:known`), 1);
  assert.equal(last(world, `${ID.front}:unknown`), 0);
  assert.equal(last(world, `${ID.front}:faces`), 1);
  // The garden sees nobody: no person feature yet (a text is never empty).
  assert.equal(text(world, `${ID.garden}:person`), undefined);
  assert.equal(last(world, `${ID.garden}:faces`), 0);
  assert.deepEqual(
    world.fake.cameraImages.map((item) => item.device_external_id),
    [ID.front, ID.garden],
  );
  assert.match(world.fake.cameraImages[0].image, /^image\/jpg;base64,\/9j\//);
  assert.deepEqual(
    world.fake.transports.map((item) => [item.device_external_id, item.transport]),
    [
      [ID.front, 'local'],
      [ID.garden, 'local'],
    ],
  );
  // The device creation is not a regular analysis: no scene event.
  assert.deepEqual(world.fake.sceneEvents, []);
  assert.ok(world.fake.widgetRefreshes.length > 0);
});

test('regular analyses: only changes published, an event when someone appears', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  world.clock.advance(30_000);
  await world.monitor.tick();
  // Already in view when the device was added: nobody "appeared".
  assert.deepEqual(world.fake.sceneEvents, []);
  const states = world.fake.states.length;
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.equal(world.fake.states.length, states, 'nothing changed, nothing published');

  // Alice leaves the front door; a stranger comes into the garden.
  world.server.scene('front', 'nobody');
  world.server.scene('garden', 'stranger');
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.equal(last(world, `${ID.front}:known`), 0);
  assert.equal(text(world, `${ID.front}:person`), 'Alice', 'the last person stays');
  assert.equal(last(world, `${ID.garden}:unknown`), 1);
  // Alice comes back with the stranger in front; the garden empties.
  world.server.scene('front', 'two');
  world.server.scene('garden', 'nobody');
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => [event.key, event.data]),
    [
      ['unknown_face', { camera: ID.garden, camera_name: 'Garden', faces: 1 }],
      [
        'person_recognized',
        { camera: ID.front, camera_name: 'Front door', person: 'Alice', similarity: 100 },
      ],
      ['unknown_face', { camera: ID.front, camera_name: 'Front door', faces: 1 }],
    ],
  );
  assert.equal(last(world, `${ID.front}:faces`), 2);
  // Still in view: no new event.
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.equal(world.fake.sceneEvents.length, 3);
});

test('after a restart, the first regular analysis records the scene without an event', async (t) => {
  const created = (await createWorld()).fake.discoveredDevices;
  const world = await createWorld({ created });
  t.after(() => world.app.stop());
  await world.monitor.tick();
  assert.deepEqual(world.fake.sceneEvents, []);
  world.server.scene('garden', 'alice');
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => [event.key, event.data.camera]),
    [['person_recognized', ID.garden]],
  );
});

test('the similarity threshold decides who is known', async (t) => {
  const world = await createWorld({ config: { ...BASE_CONFIG, similarity: '70' } });
  t.after(() => world.app.stop());
  world.server.scene('front', 'stranger');
  await createAll(world);
  assert.equal(last(world, `${ID.front}:known`), 0);
  assert.equal(last(world, `${ID.front}:unknown`), 1);
  const body = world.server.requests.find((r) => r.url.includes('/recognize'));
  assert.equal(new URL(body.url).searchParams.get('det_prob_threshold'), '0.8');
});

test('a regular analysis skips a camera analyzed on demand less than half an interval ago', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const before = recognitions(world);
  world.clock.advance(10_000);
  await world.monitor.tick();
  assert.equal(recognitions(world), before);
  world.clock.advance(10_000);
  await world.monitor.tick();
  assert.equal(recognitions(world), before + 2);
});

test('the scene action analyzes now and returns outputs, without firing an event', async (t) => {
  const world = await createWorld({ config: { ...BASE_CONFIG, language: 'fr' } });
  t.after(() => world.app.stop());
  await createAll(world);
  world.server.scene('front', 'two');
  const ack = await world.fake.sceneAction('analyze', { camera: ID.front });
  assert.deepEqual(ack, {
    success: true,
    data: {
      outputs: {
        recognized: true,
        person: 'Alice',
        people: 'Alice',
        similarity: 100,
        unknown: 1,
        faces: 2,
        result: 'Alice (100 %), Visage inconnu',
      },
    },
  });
  assert.deepEqual(world.fake.sceneEvents, []);
  const failed = await world.fake.sceneAction('analyze', {
    camera: 'ext:test-integration:camera:9',
  });
  assert.equal(failed.success, false);
  assert.match(failed.error.fr, /n'est plus dans la configuration/);
});

test('a camera that stops answering: one event, a red badge, a red action; then back', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  world.server.cameras.get('front').down = true;
  world.clock.advance(30_000);
  await world.monitor.tick();
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.deepEqual(
    world.fake.sceneEvents
      .filter((event) => event.key === 'camera_unreachable')
      .map((event) => event.data),
    [{ camera: ID.front, camera_name: 'Front door' }],
  );
  const badges = () =>
    world.fake.transports
      .filter((item) => item.device_external_id === ID.front)
      .map((item) => item.transport);
  assert.equal(badges().at(-1), 'unreachable');
  const ack = await world.fake.sceneAction('analyze', { camera: ID.front });
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /L'image de la caméra n'a pas pu être lue/);
  const widget = await world.fake.widgetGet('camera', {
    settings: { camera: ID.front },
    language: 'en',
  });
  assert.match(widget.data.content.components[0].text, /image not read/);
  // Gladys asks for the image: no old picture passed off as current.
  const image = await world.fake.getImage({ external_id: ID.front });
  assert.equal(image.success, false);

  world.server.cameras.get('front').down = false;
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.deepEqual(badges().slice(-2), ['unreachable', 'local']);
});

test('CompreFace down: the status turns red, comes back by itself; actions fail in red', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  world.server.down = true;
  world.clock.advance(30_000);
  await world.monitor.tick();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.fr, /CompreFace ne répond pas/);
  const check = await world.fake.action('check', {});
  assert.equal(check.success, false);
  assert.match(check.error.de, /CompreFace antwortet unter dieser Adresse nicht/);
  const scene = await world.fake.sceneAction('analyze', { camera: ID.front });
  assert.equal(scene.success, false);
  assert.ok(scene.error.es);
  world.server.down = false;
  await world.monitor.housekeeping();
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  const ok = await world.fake.action('check', {});
  assert.equal(ok.success, true);
  assert.equal(
    ok.data.message.en,
    [
      'CompreFace answers at http://192.0.2.10:8000, 1 known person(s).',
      'Known: Alice.',
      '- Front door: Alice (99 %)',
      '- Garden: Nobody',
    ].join('\n'),
  );
});

test('an explicit port 80 stays 80 (the address is parsed once)', async (t) => {
  const world = await createWorld({ config: { ...BASE_CONFIG, url: 'http://192.0.2.10:80' } });
  t.after(() => world.app.stop());
  assert.equal(world.monitor.client.base, 'http://192.0.2.10');
});

test('a wrong key or none: the status says which, the actions fail in red', async (t) => {
  const world = await createWorld({
    config: { ...BASE_CONFIG, api_key: '00000000-0000-0000-0000-000000000000' },
  });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /refuses the API key/);
  const check = await world.fake.action('check', {});
  assert.equal(check.success, false);
  assert.match(check.error.fr, /service Recognition/);
  const none = await createWorld({ config: { ...BASE_CONFIG, api_key: '' } });
  t.after(() => none.app.stop());
  assert.match(none.fake.connectionStatus.message.en, /Enter the API key/);
});

test('no address: the status asks for one, nothing is published', async (t) => {
  const world = await createWorld({ config: {} });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /Enter the address/);
  assert.deepEqual(world.fake.discoveredDevices, []);
});

test('the check action is red when no camera can be read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.server.cameras.get('front').down = true;
  world.server.cameras.get('garden').down = true;
  const ack = await world.fake.action('check', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /Front door : image non lue/);
});

test('add a face: one face only, a name, then the person is known', async (t) => {
  const world = await createWorld({ config: { ...BASE_CONFIG, language: 'en' } });
  t.after(() => world.app.stop());
  await createAll(world);
  world.server.scene('garden', 'stranger');
  const added = await world.fake.action('add_face', { camera: ID.garden, person: '  Bob  ' });
  assert.equal(added.success, true);
  assert.equal(added.data.message.fr, 'Bob ajouté(e) à CompreFace avec le visage vu par Garden.');
  assert.deepEqual(world.server.subjects, ['Alice', 'Bob']);
  const faces = world.server.requests.find((r) => r.url.includes('/faces'));
  assert.equal(new URL(faces.url).searchParams.get('subject'), 'Bob');
  const again = await world.fake.action('add_face', { camera: ID.garden, person: 'Bob' });
  assert.equal(again.data.message.en, 'New example of Bob added, from Garden.');

  const failures = [
    [{ camera: ID.garden, person: '' }, /Enter the name/],
    [{ person: 'Bob' }, /Choose a camera/],
    [{ camera: 'ext:test-integration:camera:7', person: 'Bob' }, /no longer in/],
  ];
  world.server.scene('front', 'two');
  failures.push([{ camera: ID.front, person: 'Bob' }, /Several faces/]);
  for (const [params, message] of failures) {
    const ack = await world.fake.action('add_face', params);
    assert.equal(ack.success, false, JSON.stringify(params));
    assert.match(ack.error.en, message);
    assert.ok(ack.error.fr);
  }
  world.server.scene('front', 'nobody');
  const noFace = await world.fake.action('add_face', { camera: ID.front, person: 'Bob' });
  assert.equal(noFace.success, false);
  assert.match(noFace.error.fr, /Aucun visage/);
  world.server.cameras.get('front').down = true;
  const down = await world.fake.action('add_face', { camera: ID.front, person: 'Bob' });
  assert.equal(down.success, false);
  assert.equal(world.server.requests.filter((r) => r.url.includes('/faces')).length, 2);
});

test('a configuration change re-publishes the devices and keeps unchanged results', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const front = world.monitor.cameras.get(1).result;
  await world.fake.configUpdated({ ...BASE_CONFIG, camera_2_url: `${CAMERA_HOST}/back.jpg` });
  assert.equal(world.monitor.cameras.get(1).result, front);
  assert.equal(world.monitor.cameras.get(2).result, null);
  await world.fake.configUpdated({ ...BASE_CONFIG, similarity: '95' });
  assert.equal(world.monitor.cameras.get(1).result, null, 'new threshold, new analysis');
  assert.equal(world.monitor.cameras.get(1).lastKnown.name, 'Alice', 'the past stays');
});

test('the image Gladys asks for: the last one when fresh, else a new analysis', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const before = recognitions(world);
  const ack = await world.fake.getImage({ external_id: ID.front });
  assert.equal(ack.success, true);
  assert.match(ack.data.image, /^image\/jpg;base64,/);
  assert.equal(recognitions(world), before);
  world.clock.advance(120_000);
  await world.fake.getImage({ external_id: ID.front });
  assert.equal(recognitions(world), before + 1);
});

test('the widget: valid content, the button hidden on demand, analyze now', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const pick = await world.fake.widgetGet('camera', { settings: {}, language: 'de' });
  assert.match(pick.data.content.components[0].text, /Wähle/);
  await createAll(world);
  world.server.scene('front', 'two');
  await world.fake.sceneAction('analyze', { camera: ID.front });
  const ack = await world.fake.widgetGet('camera', {
    settings: { camera: ID.front },
    language: 'es',
  });
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(
    content.components.map((item) => item.type),
    ['text', 'image', 'status', 'button'],
  );
  assert.deepEqual(
    content.components[2].items.map((item) => [item.label, item.value]),
    [
      ['En el encuadre', 'Alice (100 %)'],
      ['Rostros desconocidos', 1],
      ['Última reconocida', 'Alice, 16/11/26, 12:00'],
    ],
  );
  const image = await world.fake.widgetGetImage(content.components[1].key);
  assert.equal(image.success, true);
  const hidden = await world.fake.widgetGet('camera', {
    settings: { camera: ID.front, hide_button: true },
    language: 'es',
  });
  assert.ok(!hidden.data.content.components.some((item) => item.type === 'button'));

  const action = await world.fake.widgetAction(
    'camera',
    'analyze_1',
    {},
    { settings: { camera: ID.front } },
  );
  assert.equal(action.success, true);
  assert.equal(action.data.message.fr, 'Front door: Alice (100 %), Visage inconnu');
  world.server.cameras.get('front').down = true;
  const failed = await world.fake.widgetAction(
    'camera',
    'analyze_1',
    {},
    { settings: { camera: ID.front } },
  );
  assert.equal(failed.success, false);
  assert.ok(failed.error.fr);
});

test('the widget shows the name given in Gladys', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const device = world.fake.devices.find((item) => item.external_id === ID.front);
  await world.fake.deviceUpdated({ ...device, name: 'Entrée' });
  const ack = await world.fake.widgetGet('camera', {
    settings: { camera: ID.front },
    language: 'fr',
  });
  assert.equal(ack.data.content.components[1].alt, 'Entrée');
});

test('the heartbeat re-sends unchanged states after 12 hours', async (t) => {
  const world = await createWorld({ config: { ...BASE_CONFIG, interval: '0' } });
  t.after(() => world.app.stop());
  await createAll(world);
  const count = world.fake.states.length;
  await world.monitor.housekeeping();
  assert.equal(world.fake.states.length, count);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 13 * 60 * 60 * 1000 });
  await world.monitor.housekeeping();
  assert.ok(world.fake.states.length > count);
});

test('cameras missed at start (server not ready) are analyzed at the next housekeeping', async (t) => {
  const server = new FakeCompreFace();
  server.down = true;
  const created = (await createWorld()).fake.discoveredDevices;
  const world = await createWorld({ server, created });
  t.after(() => world.app.stop());
  await world.monitor.tick();
  server.down = false;
  await world.monitor.housekeeping();
  assert.equal(text(world, `${ID.front}:person`), 'Alice');
  assert.equal(last(world, `${ID.garden}:faces`), 0);
});
