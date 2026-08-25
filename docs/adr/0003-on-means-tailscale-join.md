---
status: superseded by ADR-0008
---

# Slot State `on` means Tailscale Join, not a live GitHub run

`on` used to mean the GitHub workflow run was in progress. That is too early: sshd is not up until the session claims the reserved hostname. This Worker now asks the Tailscale devices API whether that hostname is online, and only then reports `on`. Parsing Actions logs and a ready-callback from `debug-session` were rejected so this plane stays an observer, not a second protocol with the machine.

Session Deadline is 330 minutes after `run_started_at`, copied from `debug-session` (`SESSION_DEADLINE_EPOCH`). The GitHub job timeout is 360 minutes and is not shown.

If Tailscale OAuth credentials are missing, Join is unknown and `on` falls back to “run in progress” so local Open/Close still works.
