# CompreFace answers

Recorded on 2026-11-20 from a real CompreFace server (`exadel/compreface:1.2.0`, all-in-one image,
CPU) through its REST API, recognition service, with public-domain portraits (official portraits of
the US government, Wikimedia Commons). The person added is named `Alice` here; ids and keys are
replaced by a placeholder UUID. The photos themselves are not stored.

- `subjects-empty.json`, `subjects.json`: `GET /api/v1/recognition/subjects`, before and after a face
  was added.
- `add-face.json`: `POST /faces?subject=Alice` with a first portrait.
- `recognize-empty-db.json`: `POST /recognize` while the service knows nobody (a face, no subject).
- `recognize-known.json`: another portrait of the same person (similarity 0.99).
- `recognize-unknown.json`: someone else (closest subject at 0.21).
- `recognize-two.json`: both side by side in one picture.
- `recognize-noface.json`: a landscape; CompreFace answers the same (code 28) for bytes that are not
  an image.
- `badkey-unknown.json` (a key of no recognition service, a Detection key too), `badkey-format.json`,
  `nokey.json`: the key errors.
