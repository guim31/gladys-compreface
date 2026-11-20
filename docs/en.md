# CompreFace

Brings the **local face recognition** of [CompreFace](https://github.com/exadel-inc/CompreFace)
(Exadel, open source) to the images of your cameras: Gladys knows who is in view among the people you
taught CompreFace, sees the faces it does not know, and can start a scene when someone appears.
Everything stays on your network: the pictures go from the camera to the integration, then to your
CompreFace server, and nowhere else. CompreFace analyzes one picture on demand; it is not a video
recorder.

Tested against a real CompreFace server in Docker (`exadel/compreface:1.2.0`, CPU) with public-domain
portraits (a person added, then recognized on another photo; unknown people; a landscape without a
face; a wrong key; the server stopped), not yet with real cameras in service: feedback welcome on
[GitHub](https://github.com/guim31/gladys-compreface/issues) or on the Gladys forum.

## What you need

- Gladys 5.1 or later.
- A CompreFace server, reachable from Gladys on its port (8000 by default), with an application and a
  service of type **Recognition**: its **API key** is what the integration needs.
- For each camera, a **JPEG snapshot URL** (most IP cameras have one, e.g.
  `http://user:password@192.168.1.30/snapshot.jpg`).

An integration cannot read the image of a camera already in Gladys (no such access for external
integrations): give the camera's own address.

## Installation

1. Start CompreFace, for example the all-in-one image:
   `docker run -d --restart unless-stopped -p 8000:80 exadel/compreface:1.2.0` (it needs about 2 GB of
   RAM and a CPU with AVX). Open `http://<server>:8000`, create your account, an application, then a
   **Recognition** service, and copy its API key.
2. In Gladys, **Integrations → Install from GitHub**, address
   `https://github.com/guim31/gladys-compreface`.
3. In the configuration, fill in **CompreFace address** and the **API key of the Recognition service**, then for each camera (up
   to four) a **Name** and a **Snapshot address**.
4. Run the **Check the connection** action: it lists the people CompreFace knows and analyzes each
   camera once.
5. Open the **Discovery** tab and add the cameras: one device per camera.
6. Teach CompreFace the faces: in its own interface (upload a few photos per person), or with the
   **Add a face** action: stand alone in front of a camera, choose it, type your name. Three to five
   examples per person, with different lights and angles, give the best results.

Settings:

- **Minimum similarity**: below it, a face is counted as unknown. 85 % is a good start; raise it if
  people get mixed up, lower it if known people show as unknown.
- **Face detection threshold**: how sure CompreFace must be that a shape is a face (80 % by default).
- **Analysis interval**: how often each added camera is analyzed, one after the other. **On demand
  only** analyzes nothing by itself (scene action, widget button, image asked by Gladys).
- **Language of the names**: feature names and scene texts.

**CPU load**: each analysis takes about half a second on a CPU for a 1080p picture. Four cameras every
5 seconds keep a small machine busy; 30 seconds is a sensible start.

## The Gladys devices

One device per camera, with:

- **Image**: the last analyzed picture (shrunk to fit Gladys).
- **Last person recognized**: the name of the last known person seen, kept until another one is.
- **Similarity (%)**: how close that face was to the person's examples.
- **Recognized at**: date and time of that recognition.
- **Known person**: a known person is in view at the last analysis (Yes/No).
- **Unknown face**: a face nobody knows is in view (Yes/No).
- **Faces**: how many faces are in view.

The badge of the device turns to "unreachable" when the camera image cannot be read.

## Dashboard widget

**CompreFace camera**: the analyzed image, the people in view with their similarity, the number of
unknown faces, the last person recognized and when, and an **Analyze now** button (the **Hide the
Analyze button** setting hides it).

## Scenes

### Triggers

- **Person recognized by CompreFace**: a known person appears in a regular analysis (absent from the
  previous one), on one camera or any. Filter on the exact name of the person (empty: anyone).
  Variables: camera, person, similarity. One event when the person appears, not one per analysis.
  Who is already in view when the device is added, after a restart or a change of settings does not
  count.
- **Unknown face seen by CompreFace**: a face nobody knows appears (none in the previous analysis).
  Variables: camera, number of unknown faces.
- **Camera image not read**: the picture of a camera could not be read (the first failure in a row).

Triggers come from the regular analyses only: with **On demand only**, they never fire.

### Actions

- **Recognize faces on a camera**: analyzes the camera now and updates its image. Outputs: known
  person seen, most similar person, people recognized, similarity, unknown faces, faces, result in
  words. It fires no trigger.

### Scene ideas

- When the doorbell rings, **Recognize faces on a camera**, then send a message "{{result}} is at the
  door" with the core's "Send a camera image" action.
- **Person recognized by CompreFace** (a child, entrance camera) on a school day afternoon →
  notification "back home".
- **Unknown face seen by CompreFace** while the alarm is on → notification with the picture.

## Privacy

Faces are biometric data. The integration sends the camera pictures only to the CompreFace server you
configured, on your network, and keeps nothing on disk: the last picture of each camera stays in
memory. The faces and examples live in your CompreFace database. Tell the people who live with you or
visit you that their faces are analyzed, and follow the law of your country about filming people.

## Troubleshooting

- **CompreFace does not answer**: check the address and port (8000), and that every CompreFace
  container runs (`docker logs`); the first start takes a few minutes.
- **CompreFace refuses the API key**: copy the key of a **Recognition** service, not of a Detection
  or Verification service.
- **Image not read**: open the camera address in a browser from the Gladys machine: it must give a
  JPEG picture, not a page. Digest authentication is not supported.
- **Known people show as unknown**: add more examples (different lights and angles), or lower
  **Minimum similarity**.
- **Add a face** says there is no face: come closer, face the camera, with enough light.
- Detailed logs: `LOG_LEVEL=debug`.

## Limits

- Four cameras at most.
- A face close to the minimum similarity, or a person who turns away for one analysis, may "appear"
  again and fire the trigger a second time.
- The camera address, password included, and the API key are stored in the integration configuration
  and visible there to the Gladys administrators: prefer a camera user that can only view.
- No video: one picture per analysis; a person passing between two analyses is missed.
- Camera images go to Gladys at most every 5 seconds per camera.
- Not affiliated with Exadel or the CompreFace project. Developed without real cameras: feedback
  welcome.
