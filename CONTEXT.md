# Session Deck

Control plane for opening and closing time-bounded GitHub-hosted sessions. The sessions themselves live in other repos; this context names the objects that plane talks about.

## Language

**Target**:
A startable session this plane observed from a GitHub `workflow_dispatch` workflow in a named repository. v1 treats each Target as exclusive: at most one live session the plane will start.
_Avoid_: slot (that is one kind of Target), plugin, adapter, service (that is a Temporary Service Session word)

**Catalog**:
The Targets currently observed from `GITHUB_REPO`. It is a GitHub observation, not a list maintained in this repo and not a plugin surface in the session repos.
_Avoid_: manifest, registry, plugin list

**Locator**:
How an operator reaches a live Target: a reserved Tailscale hostname, SSH/RDP, or a public Session Address.
_Avoid_: URL (too broad), endpoint, connection string

**Locator Block**:
The `## Locators` list a session job publishes when its core services are up. This plane observes those labeled lines and shows them; it does not decide which labels exist.
_Avoid_: manifest, plugin output, ready callback, address field

**Sensitive Fact**:
A labeled operator-facing value that a session job publishes only as an authenticated `enc:v1` envelope under `## Sensitive Facts`. This plane decrypts it with the shared Session Password after API authorization.
_Avoid_: Locator, GitHub Secret, plaintext output

**Observer**:
The GitHub signal this plane uses to derive a Target's state without a protocol to the machine: run state for a Debug Session, or job output for a Temporary Service Session.
_Avoid_: callback, webhook, ready ping

**Debug Session**:
A time-bounded remote environment on one GitHub-hosted machine, joined to Tailscale, reachable by SSH (Linux also has an optional RDP channel).
_Avoid_: runner (that is GitHub's name for the VM), job, workflow, debug switch

**Slot**:
A Debug Session Target that holds reserved capacity: `linux` (`debug-session-linux`) and `windows` (`debug-session-windows`).
_Avoid_: runner, environment, instance, Target (Slot is the reserved-capacity kind)

**Session Password**:
The control plane's sole human access credential and the decryption key shared across its session projects. It authorizes the management page and HTTP API, while session projects use it to encrypt Sensitive Facts for this plane.
_Avoid_: API key, per-run token

**Target State**:
What a Target looks like from the control plane: `off`, `starting`, `on`, `stopping`, `failed`. `on` means a Debug Session's GitHub run is live, or a Temporary Service Session's Observer reports a live Locator.
_Avoid_: ready, healthy, connected, Slot State (that name is Slot-only)

**Access Profile**:
Linux-only entry shape for a Debug Session: `mini` is SSH, `full` is SSH plus RDP.
_Avoid_: mode, tier, plan

**Session Profile**:
How fully a Debug Session machine is provisioned: `core` or `developer`.
_Avoid_: access profile (that is the entry channel, not the install set)

**Temporary Service Session**:
A Target that exposes one selected Service (Chrome, Motrix, or OpenList) at a public Session Address.
_Avoid_: Debug Session, Slot, service stack
