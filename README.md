# 📚 Reading Comprehension Question Generator

Search **any of Project Gutenberg's 70,000+ free books** and generate reading-comprehension
questions — organized into **Literal, Inferential, Analytical, and Evaluative** sections, each
with an **answer key**, **two follow-up questions**, and a **California CCSS ELA** standard label.

Questions are written by **Claude** (`claude-opus-4-8`) based on the actual book text.

## How it works

This is the dynamic version of an earlier app that only had a fixed list of hand-written
books. The pieces:

```
Browser (public/index.html)
   │  search bar  ──────────────►  GET  /api/search    ──►  Gutendex (Gutenberg catalog)
   │  generate    ──────────────►  POST /api/generate   ──►  gutenberg.org (book text)
   │                                                     └►  Claude API (writes the questions)
   └◄── rendered questions, answer keys, follow-ups, CA standards
```

A small **backend (`server.js`)** is required for two reasons:

1. **CORS** — `gutenberg.org` does not send CORS headers, so a browser can't fetch book text
   directly. The server fetches it instead.
2. **Security** — your Anthropic API key lives only in the server's environment, never in the
   browser.

## Setup

Requires **Node.js 18+** (developed on Node 22).

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.example .env
#   then edit .env and paste your key (get one at https://console.anthropic.com/)

# 3. Start the server
npm start

# 4. Open http://localhost:3000
```

Then: type a title or author → click a book → pick grade level and number of questions →
**Generate**.

## Network requirements

The server makes outbound HTTPS calls to three hosts. They must all be reachable from wherever
the server runs:

- `gutendex.com` — Project Gutenberg catalog search
- `www.gutenberg.org` — book text downloads
- `api.anthropic.com` — Claude

> If search returns "Could not reach the Gutenberg catalog" or generation fails immediately, your
> environment is blocking outbound access to one of these hosts (some sandboxes/CI restrict
> egress by default). Run it on a machine — or in an environment — where these hosts are allowed.

## Configuration

| Variable            | Required | Default | Purpose                          |
| ------------------- | -------- | ------- | -------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | —       | Authenticates Claude API calls   |
| `PORT`              | no       | `3000`  | Port the web server listens on   |

The model is `claude-opus-4-8`. To change it, edit the `MODEL` constant near the top of
`server.js`.

## Files

| File                 | Purpose                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `server.js`          | Express backend: Gutenberg search/text proxy + Claude generation    |
| `public/index.html`  | Single-page frontend (search, options, rendered questions)          |
| `.env.example`       | Template for your `ANTHROPIC_API_KEY`                               |

## Notes & limits

- Only books with a plain-text format on Gutenberg appear in search results.
- For long books, the server sends Claude a generous opening portion of the text (about 120,000
  characters) to keep cost and latency reasonable; questions about late-book events lean on the
  model's general knowledge of the work.
- "California state standards" are shown as California CCSS ELA **Reading: Literature (RL)**
  codes (e.g. `CCSS.ELA-LITERACY.RL.5.1`), matching the grade band you select.
