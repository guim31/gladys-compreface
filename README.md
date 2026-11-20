# CompreFace for Gladys Assistant

![CompreFace for Gladys Assistant](cover.png)

An external integration for [Gladys Assistant](https://gladysassistant.com) that runs the **local face
recognition** of [CompreFace](https://github.com/exadel-inc/CompreFace) (Exadel, open source) on the
images of your cameras: who is at the door among the people you taught it, and the faces it does not
know, without the cloud.

Tested against a real CompreFace server in Docker (`exadel/compreface:1.2.0`, CPU) with public-domain
portraits; developed without real cameras in service: feedback welcome.

## Features

- One Gladys device per camera (up to four, JPEG snapshot URL): analyzed image, last person
  recognized, similarity, when, "Known person", "Unknown face", number of faces.
- Scene triggers: a known person appears (filter on the name), an unknown face appears, a camera image
  cannot be read. Scene action: recognize the faces on a camera now, with outputs for the next actions.
- Dashboard widget with an "Analyze now" button.
- "Check the connection" and "Add a face" actions: teach CompreFace a face from a camera, without
  leaving Gladys.
- Pictures sent only to your CompreFace server (faces are biometric data); nothing stored on disk.
- English, French, German and Spanish.

## Requirements

- Gladys 5.1 or later.
- A CompreFace server (1.2.0 tested) reachable from Gladys, and the API key of one of its
  **Recognition** services.
- Cameras with a JPEG snapshot URL.

## Installation

In Gladys, **Integrations → Install from GitHub**, address `https://github.com/guim31/gladys-compreface`,
then follow the [documentation](docs/en.md) (also in [French](docs/fr.md), [German](docs/de.md) and
[Spanish](docs/es.md)).

## How it works

- `GET /api/v1/recognition/subjects` checks the server and the key; `POST /recognize` sends the picture
  in base64 and gets, for each face, the closest person and its similarity; a face below the minimum
  similarity is an unknown one. `POST /faces?subject=…` adds an example ("Add a face", only when the
  picture holds exactly one face).
- Snapshots are downloaded by the integration (credentials in the URL become a Basic header), so
  "camera unreachable" and "CompreFace unreachable" stay apart.
- The picture is shrunk in a worker thread by a small pure-JavaScript JPEG decoder and `jpeg-js` (no
  native module) to fit Gladys, within the 256 MB of the sandbox.
- The devices are published with `should_poll: false`: the integration's own timer analyzes the
  devices added in Gladys only, one at a time, and skips one analyzed on demand less than half an
  interval ago. States are published only when they change, with a heartbeat every 12 hours.

## Checked, and what was not

Checked for real, in Docker: the client against `exadel/compreface:1.2.0` (person added, then
recognized on another portrait at 99 %; someone else at 21 %; both in one picture; a landscape without
a face; bytes that are not an image; a Detection key, a malformed key, no key; the server stopped),
and the integration image in the Gladys sandbox constraints against that server and a test camera
serving JPEG snapshots, driven by the fake Gladys of the SDK. The recorded answers are the fixtures of
the tests (`test/fixtures/compreface`).

Not checked: real IP cameras (snapshot formats, Digest authentication), a GPU CompreFace, a real
Gladys instance.

## Limits

- Four cameras; one picture per analysis: a person passing between two analyses is missed.
- HTTP Digest authentication is not supported.
- The first recognition after CompreFace starts loads its models (45 s measured on a CPU).
- Each analysis costs CPU on the CompreFace machine: see the documentation for the interval.

## Development

```bash
npm ci
npm test
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the rules of the code.

## Credits

- [CompreFace](https://github.com/exadel-inc/CompreFace) (Apache 2.0, by Exadel): its REST API
  documentation was followed, its answers were recorded for the tests, and its logo is the cover of
  this integration.
- The recognitions in `test/fixtures/compreface` were recorded on public-domain official portraits of
  the US government (Wikimedia Commons), not stored in the repository.
- The JPEG resizing comes from guim31/gladys-shinobi via guim31/gladys-doods (Apache 2.0).

This integration is not affiliated with Exadel nor the CompreFace project.

## License

[Apache 2.0](LICENSE).
