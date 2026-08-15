# Debug Sessions stay on GitHub-hosted machines; this project is only the control plane

Opening a Debug Session still means dispatching the existing workflows in `autoactions/debug-session`. This Worker only starts, stops, and reports those runs so people and integrations never have to use the GitHub Actions UI. Replacing the GitHub-hosted VM was rejected for v1: a Worker cannot be the Linux/Windows environment, and a new compute provider would be a second provisioning stack.
