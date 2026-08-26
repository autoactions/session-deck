# Superseded: Session password stays in GitHub, not in this Worker

This v1 decision is superseded by ADR-0009. The control plane now holds the shared `SESSION_PASSWORD` so it can decrypt authenticated Sensitive Facts published by session jobs.
