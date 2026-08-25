# Observe GitHub workflow_dispatch; do not keep a closed Target list

Naming `GITHUB_REPO` still attaches a session project (ADR-0004). Hardcoding `repo` + workflow on Catalog entries meant a rename dropped the project from the page. This plane now lists active `workflow_dispatch` workflows in those repos and builds Targets from the YAML: a `run-name` of `prefix:${{ inputs.choice }}` expands to one Target per option; `TAILSCALE_HOSTNAME` selects Tailscale Join, otherwise Locator Block. Session repos still do not ship a plugin, manifest, or this plane's nouns.
