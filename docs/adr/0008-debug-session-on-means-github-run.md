# Debug Session `on` means the GitHub run is in progress

The control plane no longer holds Tailscale OAuth credentials or queries the Devices API. A Debug Session now becomes `on` when its GitHub workflow leaves the pending states and is still running; this accepts that `on` can precede Tailnet join in exchange for removing a privileged third-party Observer. Temporary Service Sessions still use their published Locator Block. This supersedes ADR-0003 and the Tailscale Join clauses in ADR-0005 through ADR-0007.
