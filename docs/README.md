# Worth documentation

Worth is a Chrome extension with a local Node service and a persistent Python Laya worker. It reads original timestamped YouTube captions and builds a viewing map.

## Status

Current: experimental alpha, 0.4.0 conservative behavior/settings update. This work-in-progress tool is not production-ready. The experimental classifier failed the 60-excerpt quality gate; automatic skipping is disabled. Historical baseline: 0.3.1. Implementation and verification status is tracked in [the roadmap](roadmap.md) and [the change log](log/2026-10-08.md).

## Read in this order

1. [Architecture and project map](architecture.md)
2. [How analysis works](analysis.md)
3. [Settings reference](settings.md)
4. [API and worker protocol](api.md)
5. [Installation and operations](operations.md)
6. [Testing and evaluation](testing.md)
7. [Privacy and limitations](privacy-and-limitations.md)
8. [Decisions](decisions.md)

[Historical verification](verification-history.md) records past runs. It is not a claim that those checks were rerun for the latest code.

[Ten-video production audit](ten-video-audit.md) compares frozen transcript reviews with the current extension API: strong precision in this sample, insufficient useful recall and filler identification. Audit completed 2026-10-09; automatic skipping remains disabled.

Every change updates its relevant document and appends a dated log entry. Plans, implementation and verified results must be identified separately. Runtime service logs are diagnostic output, not the project change log.
