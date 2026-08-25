# Tunnel Targets use GitHub job output as the Observer; they do not callback this Worker

Debug Session `on` still means Tailscale Join (ADR-0003). Temporary Service Sessions have no equivalent third-party Observer: the Session Address exists only in the live GitHub job after readiness. This plane reads that already-published, non-secret line from the job summary or logs. A ready webhook from the machine was rejected again so the plane stays an observer of GitHub, not a second protocol with the session.
