# Dependency — Upgrade Impact Analyzer

Analyze whether upgrading a third-party npm package will break your repository.

The tool clones a Git repository, statically analyzes how it uses external npm
packages, downloads the installed and target versions of a package from npm,
diffs their public API surfaces, and produces a breaking-change impact report —
grounded in documentation retrieved with **RAG** and reasoned over by an
**LLM (Gemini)**.

## Features

- **Static repository analysis** — Babel AST parsing of `.js` / `.jsx` / `.ts` / `.tsx`
  files to extract ESM imports, CommonJS `require()`, exports, and API usages
  (`express.Router()`, `new PrismaClient()`, `app.get()`, ...).
- **Package version snapshots** — downloads exact package versions with `npm pack`,
  extracts and parses TypeScript declarations and source to map each version's full
  API surface (interfaces, classes, functions, types, CommonJS exports).
- **API diffing** — detects added, removed, and modified APIs, including signature
  (parameter) and member-level changes with file/line references.
- **Impact matching** — matches changed APIs against real repository call sites and
  classifies each impact with a breaking flag and severity.
- **RAG documentation evidence** — retrieves migration context from the target
  package's README / CHANGELOG / HISTORY using Cohere embeddings and cosine search.
- **LLM reasoning** — Gemini classifies each impact (`confirmed breaking change`,
  `likely breaking change`, `no impact`, ...) and proposes migration steps.

## Tech Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Server      | Node.js, Express 5                                  |
| Parsing     | `@babel/parser`, `@babel/traverse`                  |
| Embeddings  | Cohere (`embed-english-v3.0`)                       |
| LLM         | Google Gemini (`@google/genai`)                     |
| Git         | `simple-git`                                        |
| Package mgr | npm                                                 |

## Architecture

```
┌────────────────┐     git clone     ┌──────────────────┐
│  POST /clone   │ ─────────────────►│  ../repos/<name> │
└────────────────┘                   └────────┬─────────┘
                                              │
                                              ▼
                              ┌──────────────────────────┐
                              │ Static repo analysis      │
                              │ AST → imports, requires,  │
                              │ exports, API usages       │
                              └────────────┬─────────────┘
                                           ▼
                              ┌──────────────────────────┐
                              │ Version compare          │
                              │ installed vs target      │
                              └────────────┬─────────────┘
                                           │ changeType = none → stop
                                           ▼
                              ┌──────────────────────────┐
                              │ npm pack both versions → │
                              │ extract API surface      │
                              └────────────┬─────────────┘
                                           ▼
                              ┌──────────────────────────┐
                              │ diff APIs → impacted     │
                              │ call sites in your repo  │
                              └────────────┬─────────────┘
                                           │
              ┌────────────────────────────┴─────────────┐
              ▼                                          ▼
   ┌──────────────────────┐                 ┌──────────────────────┐
   │ RAG                  │                 │ Deterministic        │
   │ README/CHANGELOG ─►  │                 │ compatibility check  │
   │ chunk ─► embed ─►    │                 └──────────┬───────────┘
   │ vector search        │                            │
   └──────────┬───────────┘                            │
              └──────────────┬─────────────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ Evidence + Gemini (LLM)      │
              │ classification & migration  │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ Final impact report JSON     │
              └──────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+ (ESM; uses top-level await)
- npm
- API keys for Cohere and Google Gemini

### Installation

```bash
cd server
npm install
```

### Configuration

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

| Variable                            | Required | Default                | Description                                  |
|-------------------------------------|----------|------------------------|----------------------------------------------|
| `GEMINI_API_KEY`                    | yes      | —                      | Google Gemini API key for LLM analysis      |
| `COHERE_API_KEY`                    | yes      | —                      | Cohere API key for embeddings               |
| `RAG_EMBEDDING_MODEL`               | no       | `embed-english-v3.0`   | Cohere embedding model                      |
| `RAG_EMBEDDING_ENABLED`             | no       | `true`                 | Set to `false` to skip RAG embedding        |
| `RAG_EMBEDDING_BATCH_SIZE`          | no       | `96`                   | Embeddings per batch                        |
| `RAG_EMBEDDING_MAX_RETRIES`         | no       | `3`                    | Retries for rate-limited embedding calls    |
| `RAG_EMBEDDING_RETRY_DELAY_MS`      | no       | `1000`                 | Retry backoff delay                         |
| `RAG_EMBEDDING_RATE_LIMIT_DELAY_MS` | no       | `200`                  | Delay between embedding batches             |

### Run

```bash
node index.js
# or with auto-reload
npx nodemon index.js
```

The server starts on `http://localhost:3000`. Health check: `GET /health`.

## API Reference

### `POST /repo/clone`

Clones a Git repository into `../repos/`.

```bash
curl -X POST http://localhost:3000/repo/clone \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/user/repo.git"}'
```

Response:

```json
{ "reponame": "repo" }
```

### `POST /repo/analyze`

Runs full static analysis on a previously cloned repository.

```bash
curl -X POST http://localhost:3000/repo/analyze \
  -H "Content-Type: application/json" \
  -d '{"reponame": "repo"}'
```

Response: `{ files, dependencyGraph, packages }` — per-file imports, exports,
requires, call sites, API usages, plus the dependency graph and resolved package versions.

### `POST /repo/analyze/impact`

Analyzes the impact of upgrading a package to a target version.

```bash
curl -X POST http://localhost:3000/repo/analyze/impact \
  -H "Content-Type: application/json" \
  -d '{
    "reponame": "repo",
    "project": ".",
    "package": "express",
    "targetVersion": "5.1.0"
  }'
```

| Field           | Description                                      |
|-----------------|--------------------------------------------------|
| `reponame`      | Name of the cloned repository                    |
| `project`       | Directory (relative) containing the `package.json` (`.` for root) |
| `package`       | npm package name to upgrade                      |
| `targetVersion` | Target semantic version                          |

Response (abridged): `apiDiff`, `impacts`, `compatibilityResults`, `evidence`,
`documentationEvidence`, `releaseNotes`, `llmAnalysis`.

## The RAG Pipeline

The RAG layer answers: *"the docs say this API changed — why, and how do I migrate?"*
It complements — but does not replace — the deterministic static analysis.

1. **Corpus** — README, CHANGELOG, and HISTORY files from the target npm version
   (`packageApiAnalyzer.js` → `readPackageDocumentation`).
2. **Chunking** — `documentChunker.js` splits documents into ~1200-character chunks
   with 200-character overlap.
3. **Embedding** — `embeddings.js` embeds chunks with Cohere `embed-english-v3.0`,
   batched with retry/rate-limit handling.
4. **Vector store** — `vectorStore.js` is an in-memory store ranked by cosine similarity.
5. **Retrieval** — `upgradeRetriever.js` builds multiple queries per changed API
   (package + versions + API + change type + repository usage context), filters to
   `score >= 0.60`, and ranks by a combined evidence score (similarity + source weight
   + API name relevance + version mention).
6. **LLM consumption** — retrieved chunks are passed to Gemini as
   `DOCUMENTATION EVIDENCE`, so the final classification and migration steps are only
   produced from retrieved, real documentation.

## How It Works

1. Clone the repository (`simple-git`).
2. Statically analyze every JS/TS file with Babel AST.
3. Resolve declared package versions from `package.json` + lockfiles.
4. Download both installed and target package versions via `npm pack`.
5. Extract and compare the exported API surfaces.
6. Match changed APIs against repository call sites.
7. Retrieve documentation evidence with RAG.
8. Build a consolidated evidence object and filter it to relevant items.
9. Send the evidence to Gemini for classification and migration guidance.
10. Return the final impact report.

## Project Structure

```
├── repos/                      # Cloned repositories (gitignored)
├── server/
│   ├── index.js                # Express entry point (port 3000)
│   ├── controller/
│   │   └── repo.js             # clone / analyze / analyzeImpact controllers
│   ├── routes/
│   │   └── reporoutes.js       # /repo/* routes
│   └── service/
│       ├── analyze.js          # AST helpers: imports, requires, API usages
│       ├── packageResolver.js  # package.json / lockfile version resolution
│       ├── packageApiAnalyzer.js  # npm pack + API surface extraction
│       ├── apiDiff.js          # API diffing
│       ├── apiImpactMatcher.js # impact matching
│       ├── apiCompatibility.js # deterministic compatibility checks
│       ├── upgradeAnalyzer.js  # main pipeline
│       ├── llmAnalyzer.js      # Gemini analysis
│       └── rag/
│           ├── documentChunker.js
│           ├── embeddings.js
│           ├── vectorStore.js
│           ├── retriever.js
│           ├── packageKnowledge.js
│           ├── upgradeRetriever.js
│           └── ragEvaluator.js
└── tests/                      # Development / RAG tests
```

## Tests

Development scripts live in `tests/` (run from the repo root):

```bash
node tests/testragretrieval.js   # RAG chunk + embed + search demo
node tests/testragupgrade.js     # RAG upgrade pipeline demo
node tests/testrageval.js        # RAG evaluation (recall / precision / MRR)
```

## Security

- API keys are read from environment variables only — **never** commit `.env`.
- `.env`, `node_modules`, and cloned `repos/` are gitignored.