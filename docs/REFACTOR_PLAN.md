# Refactor Summary

The original refactor plan was an internal working document with personal
workflow notes, local repository references and step-by-step agent instructions.
It has been replaced for the public repository version.

Publicly useful outcomes of the refactor:

- Expo Router screens are separated from shared API/auth/legal logic in `lib/`.
- Guest sessions go through one SecureStore-backed auth layer.
- Backend access goes through one Axios client with a bearer interceptor.
- DSGVO surfaces are first-class app screens: privacy notice, consents, data
  export and erasure flow.
- Runtime dependency and on-device storage audits are documented.
- Jest covers critical library and screen behavior; Maestro covers local
  login/logout smoke tests.

For current architecture and rationale, read:

- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- [`docs/showcase/`](showcase/)
- [`tests/README.md`](../tests/README.md)
- [`docs/e2e.md`](e2e.md)
