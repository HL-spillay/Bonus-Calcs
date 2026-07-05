# Graphify — project knowledge graph

Graphify maps this repository (docs, SQL, Apps Script, config examples) into a **queryable knowledge graph** so you and any AI assistant can navigate the bonus-calc design by **structure and dependencies**, not by grepping every file.

This is **separate from BigQuery**:

| | Graphify | BigQuery |
|---|----------|----------|
| **Purpose** | Understand and maintain the *project* (docs, pipeline, schemas) | Run the *monthly bonus calculation* on operational data |
| **Graph of** | Files, concepts, table relationships in docs/SQL | Store → KPI → employee payout (business data) |
| **Lives in** | `graphify-out/graph.json` in this repo | `bidataops.Store_Bonus_Calculation` |

Both are useful: BigQuery computes bonuses; Graphify helps anyone (including Cursor) work on the codebase without re-reading all docs every time.

---

## One-time setup

**1. Install Graphify** (PyPI package name is `graphifyy`):

```powershell
pip install "graphifyy[gemini]"
# or: uv tool install "graphifyy[gemini]"
```

The `[gemini]` extra pulls in `openai` + `tiktoken` (Gemini backend uses the OpenAI-compatible client). Without it you get: *"the 'openai' package is required for this backend"*.

**2. Register for Cursor** (already done in this repo):

```powershell
python -m graphify cursor install --project
```

This created [`.cursor/rules/graphify.mdc`](../.cursor/rules/graphify.mdc) so Cursor prefers graph queries before blind file search.

**3. Set an LLM API key** (required for markdown/docs — this repo is mostly documentation until SQL is added):

```powershell
$env:GEMINI_API_KEY = "your-key"   # or GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
```

Code-only corpora need no key; this project includes multiple `.md` docs, so a key is required for the first full build.

**4. Build the graph:**

```powershell
cd C:\Users\Sudashen\Documents\WorkSpace\GitSpace\Bonus-Calcs
python -m graphify .
```

Outputs:

```
graphify-out/
├── graph.html          # Interactive browser view
├── GRAPH_REPORT.md     # Architecture summary + suggested questions
└── graph.json          # Full graph — query offline
```

Open `graphify-out/graph.html` in a browser to explore nodes and edges visually.

---

## Day-to-day commands

| Command | When to use |
|---------|-------------|
| `python -m graphify query "How does policy_key flow to payout?"` | Before reading many files |
| `python -m graphify path "stg_labour_clocking" "rpt_payout_per_person"` | Trace pipeline dependencies |
| `python -m graphify explain "cfg_overrider_tier"` | What connects to a concept |
| `python -m graphify update .` | After editing SQL or `.gs` files (AST-only, **no API cost**) |
| `python -m graphify .` | After large doc changes (full rebuild; uses LLM for docs) |

In Cursor chat you can also type `/graphify .` if the Graphify skill is installed globally.

---

## What gets indexed

Included by default:

- `docs/` — design, schemas, pipeline, decisions
- `sql/` — DDL and pipeline SQL (as it is added)
- `*.gs` — Apps Script glue
- Example CSVs (criteria exports)

Excluded via [`.graphifyignore`](../.graphifyignore):

- Large `.xlsx` workbooks
- `.cursor/` internals
- Generated `graphify-out/` (avoid recursive indexing)

---

## Handoff for the next developer

1. Clone repo, install `graphifyy`, set API key.
2. Run `python -m graphify .` once (or use committed `graphify-out/GRAPH_REPORT.md` if checked in).
3. Read [README.md](README.md) → [design.md](design.md) → [schemas-and-pipeline.md](schemas-and-pipeline.md).
4. Use `graphify query` for specific questions while implementing SQL.
5. After each SQL milestone, run `graphify update .` and commit updated `graph.json` / `GRAPH_REPORT.md` (optional but helps the team).

---

## Optional: MCP server

For assistants that support MCP:

```powershell
uv tool install "graphifyy[mcp]"
graphify serve   # exposes query_graph, get_neighbors, shortest_path
```

Not required for Cursor if the `.cursor/rules/graphify.mdc` rule + CLI queries are enough.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `the 'openai' package is required` | Run `pip install "graphifyy[gemini]"` |
| `no LLM API key found` | Set `GEMINI_API_KEY` (or another supported key) before first `graphify .` |
| `graphify: command not found` | Use `python -m graphify` or run `uv tool update-shell` |
| Graph stale after doc edits | Re-run `python -m graphify .` |
| Graph stale after SQL/.gs edits only | `python -m graphify update .` |
