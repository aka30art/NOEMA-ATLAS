# NOEMA ATLAS — Content Architecture

## Phase 2B — Universal domains and specialist collections

The catalogue separates two dimensions:

- **Universal domains** classify the creative task: ART, PHOTO, VIDEO, AGENTS, MATERIALS, TEXTURES, EFFECTS, 3D & OBJECTS, DESIGN, WORLDS, AUDIO and GENERATIVE SYSTEMS.
- **Specialist collections** group dedicated creative universes across domains. Initial specialist collections are ANIME & CARTOON and TOYS & COLLECTIBLES.

A prompt has one canonical record and may be indexed into multiple collections through `collectionIds`. Each collection maintains the reciprocal `promptIds` index. The content validator checks both sides of this relationship. The library can filter by domain and collection without duplicating prompt records.

The initial catalogue contains 50 published prompt records and six curated collections.

## Phase 2A.2

This repository is the canonical source of public NOEMA ATLAS content. The application remains static and deploys through GitHub Pages. No external service or runtime backend is introduced.

## Data ownership

- `data/*.json` contains public, repository-managed catalogue content.
- `schemas/*.schema.json` defines stable record contracts.
- Browser-local saved prompts and custom vault records remain personal to the current browser.
- Git history is the authoritative revision history for repository-managed content.
- Prompt-level `version` is a content revision number, distinct from Git commit history.

## Stable identifiers

IDs are lowercase slugs and are treated as permanent references. Titles and display names may change without changing IDs. Relationships use IDs, not array positions or display labels.

## Prompt record

Required fields: `id`, `title`, `domainId`, `description`, `tags`, `prompt`, `status`, `visibility`, `version`.

Optional extension fields include timestamps, collection references, model compatibility and parameters. New fields must be documented and schema-validated.

## Dataset envelope

Every catalogue dataset uses:
```json
{ "schemaVersion": "1.0.0", "items": [] }
```

## Future portability

The record contracts are backend-neutral. A future account or synchronisation layer may add user ownership and storage adapters without changing public content IDs or the catalogue model. No credentials, tokens or secrets may be committed or shipped to the browser.
