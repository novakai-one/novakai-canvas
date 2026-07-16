# Novakai Canvas

Selectable architecture maps backed by editable JSON.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Data

- `public/data/project-architecture.json` owns map meaning.
- `public/data/canvas-preferences.json` owns presentation preferences.

Canvas edits write back through the development file adapter.

## Validate

```bash
npm run check
```

This runs linting, tests, typechecking, and production building.
