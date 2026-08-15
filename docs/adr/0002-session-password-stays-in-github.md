# Session password stays in GitHub, not in this Worker

The control plane shows Slot State, the reserved Tailscale hostname, and the GitHub run URL. It does not hold or display `SESSION_PASSWORD`. That secret already lives in `autoactions/debug-session`; copying it here would create a second place to leak it, and operators already know it. Copy-password on the page was rejected for v1.
