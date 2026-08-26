# Session jobs publish a Locator Block; this plane does not keep per-target match rules

Catalog extractors would make this Worker the authority on what counts as post-start information. Session repos already know that. They write a fenced `## Locators` list of `- Label: value` lines into the job summary and logs. This plane has one parser and renders the rows. A plugin or SDK in the session repo was still rejected (ADR-0004): attaching a project is naming its GitHub repo plus Catalog dispatch/`on` Observer, not teaching the session repo this plane's nouns.

`on` stays split: Debug Session is GitHub run state (ADR-0008); Temporary Service Sessions are “the Locator Block has at least one row.” Public Locators stay separate from encrypted Sensitive Facts (ADR-0009).
