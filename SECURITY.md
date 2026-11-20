# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

The integration stores nothing in `/data`, and no picture on disk: the last
picture of each camera stays in memory. Its configuration (held by Gladys)
holds the address of the CompreFace server, the API key of a recognition
service, and the camera addresses, which may carry a user name and password
(`http://user:password@…`): the key is sent only to CompreFace (`x-api-key`
header), the camera credentials only to the camera (an HTTP Basic header), and
neither is ever logged (the logs show the scheme, host and port of a camera
only; CompreFace writes a refused key in its error message, which is not
logged). Camera pictures, which hold faces (biometric data), go only to the
configured CompreFace server, on the local network, over HTTP unless an
`https://` address is given.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
CompreFace, and the cameras the integration reads.
