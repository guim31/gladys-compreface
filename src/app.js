// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake) and
// returns the monitor, so index.js stays a few lines and the tests drive the
// very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig } from './config.js';
import { resultText } from './devices.js';
import { FaceMonitor } from './monitor.js';
import { SCENE_ACTIONS } from './scenes.js';
import {
  ActionFailure,
  CONNECTION_TEXT,
  FAILURE,
  INIT_FAILED,
  checkMessage,
  faceAdded,
} from './texts.js';
import { WIDGETS, widgetImage } from './widgets.js';

const logger = createLogger({ name: 'compreface-app' });

/** The "Check the connection" action: the server, then one analysis per camera. */
export async function check(monitor) {
  const server = await monitor.checkServer();
  if (!server.ok) {
    throw new ActionFailure(CONNECTION_TEXT[server.problem]);
  }
  const cameras = [];
  for (const camera of monitor.cameras.values()) {
    if (!camera.validUrl) {
      cameras.push({ name: camera.name, failed: true });
      continue;
    }
    try {
      const summary = await monitor.analyze(camera, { events: false });
      cameras.push({
        name: monitor.nameOf(camera),
        text: Object.fromEntries(LANGUAGES.map((lang) => [lang, resultText(summary, lang)])),
      });
    } catch (err) {
      // The server may fail meanwhile: a camera is "not read" only for its own fault.
      cameras.push({
        name: monitor.nameOf(camera),
        failed: true,
        server: err?.message !== FAILURE.camera,
      });
    }
  }
  logger.info(`Connection checked: ${cameras.length} camera(s)`);
  const report = checkMessage({ url: monitor.client.base, subjects: server.subjects, cameras });
  // Red when no configured camera could be read: the setup does not work yet.
  if (cameras.length > 0 && cameras.every((camera) => camera.failed)) {
    throw new ActionFailure(report);
  }
  return report;
}

/** The "Add a face" action: the face a camera sees now, as an example of a person. */
export async function addFace(monitor, params = {}) {
  const camera = monitor.require(params.camera);
  const { subject, isNew } = await monitor.addFace(camera, params.person);
  return faceAdded(subject, isNew, monitor.nameOf(camera));
}

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: fetch, timers, clock, timings
 */
export function registerHandlers(gladys, options = {}) {
  const monitor = new FaceMonitor({
    gladys,
    fetch: options.fetch,
    timers: options.timers ?? true,
    clock: options.clock,
    timings: options.timings,
  });

  // Resolved once the monitor has started; every handler waits for it.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        // A reconnection (Gladys restarted): re-sync what Gladys may have lost.
        await monitor.resync(config);
        return;
      }
      await monitor.start(config);
      started = true;
    } catch (err) {
      logger.error('Initialization failed', err);
      // Checked again (and the status set again) by the next housekeeping.
      monitor.server = null;
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => monitor.publishDevices()));

  // A fresh image: dashboard, chat ("show me the camera"), the core's "Send a
  // camera image" scene action. Awaited under 15 s by Gladys.
  gladys.onGetImage(whenReady((device) => monitor.imageFor(device?.external_id)));

  // The devices are published with should_poll: false (the integration's own
  // timer); this only serves a Gladys that would poll anyway.
  gladys.onPoll(whenReady(async () => {}));

  gladys.onDeviceCreated(whenReady((device) => monitor.onDeviceCreated(device)));
  gladys.onDeviceUpdated?.(whenReady(async () => monitor.requestWidgetRefresh()));
  gladys.onDeviceDeleted?.(whenReady(async () => monitor.requestWidgetRefresh()));

  gladys.onConfigUpdated(
    whenReady(async (newConfig) => {
      try {
        await monitor.reconfigure(normalizeConfig(newConfig));
      } catch (err) {
        logger.error('New configuration not applied', err);
        throw new ActionFailure(INIT_FAILED);
      }
    }),
  );

  gladys.onAction(
    'check',
    whenReady(() => check(monitor)),
  );
  gladys.onAction(
    'add_face',
    whenReady((params) => addFace(monitor, params)),
  );

  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(
      key,
      whenReady((fields) => handler(monitor, { fields })),
    );
  }

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(monitor, request)),
    );
    gladys.onWidgetAction(
      key,
      whenReady((actionKey, params, context = {}) =>
        widget.action(monitor, { actionKey, params, ...context }),
      ),
    );
  }
  gladys.onWidgetGetImage(whenReady((key) => widgetImage(monitor, key)));

  return {
    monitor,
    ready,
    stop: () => monitor.stop(),
  };
}
