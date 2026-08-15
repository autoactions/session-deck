# Debug Session Control

Control plane for opening and closing Debug Sessions. The sessions themselves live in the sibling `debug-session` repo; this context names the objects that plane talks about.

## Language

**Debug Session**:
A time-bounded remote environment on one GitHub-hosted machine, joined to Tailscale, reachable by SSH (Linux also has an optional RDP channel).
_Avoid_: runner (that is GitHub's name for the VM), job, workflow, debug switch

**Slot**:
A reserved capacity that holds at most one Debug Session. There are two: `linux` (`debug-session-linux`) and `windows` (`debug-session-windows`).
_Avoid_: runner, environment, instance

**Admin Token**:
The single shared secret that authorizes both the management page and the HTTP API.
_Avoid_: API key, password, session token

**Slot State**:
What a Slot looks like from the control plane, derived only from the GitHub workflow run: `off`, `starting`, `on`, `stopping`, `failed`. `on` means the run is in progress, not that SSH is proven ready.
_Avoid_: ready, healthy, connected

**Access Profile**:
Linux-only entry shape for a Debug Session: `mini` is SSH, `full` is SSH plus RDP.
_Avoid_: mode, tier, plan

**Session Profile**:
How fully the machine is provisioned: `core` or `developer`.
_Avoid_: access profile (that is the entry channel, not the install set)
