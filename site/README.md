# Glasses vote application

The Git repository root is one directory above this folder. See [the project README](../README.md) for setup, photo configuration, voting behavior, and hosting instructions.

From the root, run `npm run setup` to create local configuration and generic placeholders without overwriting existing data. Install dependencies with `npm --prefix site run install:ci`. Run `npm test` and `npm run build` from the root.

Photos in `public/photos/`, the personal mapping in `public/pairs.json`, `.openai/hosting.json`, environment files, and local database state are excluded from Git. Only generic examples and application code belong in the repository.
