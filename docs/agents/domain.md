# Domain docs

Single context. Before exploring, read these if they exist (don't flag them if missing):

- **`docs/GLOSSARY.md`**: the project's terms. `/domain-modeling` creates it when the first term is resolved.
- **`docs/decisions.md`**: product and architecture decisions (ADRs), newest first. Read the ones that touch the area you're working in.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a test name, a proposal), use the term as defined in `docs/GLOSSARY.md`. A concept missing from the glossary is a signal: either you're inventing language the project doesn't use, or there's a gap to note for `/domain-modeling`.

## Flag decision conflicts

If your output contradicts an entry in `docs/decisions.md`, say so instead of silently overriding it:

> _Contradicts "Server-only tables live in a `private` schema", but worth reopening because…_
