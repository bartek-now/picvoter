# Glasses vote

A photo comparison app with named, ranked ballots and shared vote storage in Cloudflare D1. The voting screen uses HTML, CSS, and JavaScript; a Vinext API saves ballots and protects results with an owner key.

This directory is the Git repository root. Application code lives in `site/`, and repository scripts live in `scripts/`.

## Local setup

Requires Node 22.13 or newer. From the repository root:

```powershell
npm run setup
npm --prefix site run install:ci
npm test
npm run build
```

Setup creates ignored local configuration and generic placeholder photos from the checked-in examples. It never replaces existing photos or settings.

Edit `site/public/pairs.json` to configure your own pairs, and put the files in `site/public/photos/`. Each pair's `id` is its permanent score key; keep existing IDs unchanged after voting starts. `mirrorCrop` controls the first-photo crop in the gallery and enlarged view. Optional `photoCrops` and `photoLabels` arrays configure each view separately. Your photos, pair mapping, and crop settings stay local and are excluded from Git.

Prepare oriented, metadata-free JPEG copies of your own photos on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-photos.ps1 -Source 'C:\path\to\your\photos'
```

Create an ignored `site/.dev.vars` containing `RESULTS_KEY=your-private-key`. After building, apply each pending SQL migration once to the local database, using its actual filename:

```powershell
cd site
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_open_kronos.sql
npm run dev
```

The server prints its URL, usually `http://localhost:5173`. Local and hosted databases are separate. From `site/`, `npm start -- --env-file ../../.dev.vars` previews the built Worker.

## Voting and results

Voters enter a name and rank one or more frames. With N frames, ranks award N through 1 points; unranked frames get zero. Scores use the current option count. Frames display in filename order; ballots retain permanent filename IDs when frames are reordered or added. Ties sort by first-place votes, then score key.

A random browser ballot ID makes retries and edits update the existing vote. Browser storage retains the draft; D1 stores submissions. Names are self-reported but unique across ballots (ignoring letter case for A-Z and surrounding spaces). If a name is taken, add a surname initial, such as Alex M. The same browser can update its own ballot; another browser cannot claim the same name.

Open `/results.html` and enter the results key to see scores, named ballots, and export JSON. Configure hosted `RESULTS_KEY` as a runtime secret. Neither names nor scores are exposed by the results API without this key.

## Hosting and private files

`site/.openai/hosting.json` is ignored local deployment configuration. Setup copies its generic example, which declares the D1 `DB` binding without a project identity. Register a hosting project before publishing, and retain its assigned identity locally. Configure runtime secrets through your hosting provider.

Photos, personal pair mappings, hosting identities, environment files, database files, exports, `.work/`, dependency folders, and generated output are ignored. The committed examples and tests contain synthetic data. Run `git status` from this directory before committing to review what will be shared.

The public source repository excludes personal assets. A deployment assembled from your local folder can still include your configured photos for the voting site.
