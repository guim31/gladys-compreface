# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Local face recognition with CompreFace on up to four cameras (JPEG snapshot
  URL): one Gladys device per camera with its analyzed image, the last person
  recognized, the similarity and when, "Known person", "Unknown face" and the
  number of faces.
- Minimum similarity and face detection threshold; analysis interval from 5
  seconds to 15 minutes, or on demand only.
- Scene triggers "Person recognized by CompreFace" (when a known person
  appears, filter on the name), "Unknown face seen by CompreFace" and "Camera
  image not read"; scene action "Recognize faces on a camera" with its outputs
  (person, people, similarity, unknown faces, result).
- Dashboard widget "CompreFace camera" with an "Analyze now" button.
- "Check the connection" action (the people CompreFace knows, one analysis per
  camera) and "Add a face" action (the face a camera sees now becomes an
  example of a person).
- English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-compreface/commits/main
