"use strict";

/**
 * Reading Comprehension Generator — backend
 *
 * Three jobs:
 *   1. GET  /api/search    — proxy Gutendex to find any of Project Gutenberg's ~70,000 books
 *   2. POST /api/generate  — fetch the book text from gutenberg.org (server-side, no CORS),
 *                            then call Claude to write comprehension questions
 *   3. serve the static frontend in /public
 *
 * The Anthropic API key lives ONLY here, in the ANTHROPIC_API_KEY environment
 * variable — never in the browser.
 */

const path = require("path");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MODEL = "claude-opus-4-8";
// How much of the book text to feed the model. Whole novels can be millions of
// characters; this keeps token cost bounded while giving plenty of context.
const MAX_BOOK_CHARS = 120000;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// ---------------------------------------------------------------------------
// 1. Search Project Gutenberg via the Gutendex API
// ---------------------------------------------------------------------------
app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ results: [] });

  try {
    const url = `https://gutendex.com/books?search=${encodeURIComponent(q)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Gutendex returned ${resp.status}`);
    const data = await resp.json();

    const results = (data.results || [])
      .map((b) => ({
        id: b.id,
        title: b.title,
        author: (b.authors || []).map((a) => a.name).join(", ") || "Unknown",
        hasText: !!pickPlainTextUrl(b.formats),
      }))
      // only books we can actually pull plain text for
      .filter((b) => b.hasText)
      .slice(0, 24);

    res.json({ results });
  } catch (err) {
    console.error("search error:", err);
    res.status(502).json({ error: "Could not reach the Gutenberg catalog. Try again." });
  }
});

// ---------------------------------------------------------------------------
// 2. Generate comprehension questions for a chosen book
// ---------------------------------------------------------------------------
app.post("/api/generate", async (req, res) => {
  const { gutenbergId, title, author, gradeLevel, numQuestions, passageText } =
    req.body || {};

  const num = Math.min(Math.max(parseInt(numQuestions, 10) || 5, 3), 10);
  const grade = gradeLevel || "3-5";

  let bookText;
  let isCustomPassage = false;
  let workTitle = (title || "").trim();
  let workAuthor = (author || "").trim();

  try {
    if (passageText && passageText.trim()) {
      // Mode 1: user pasted their own passage — use it directly, no Gutenberg fetch.
      if (passageText.trim().length < 50) {
        return res.status(400).json({
          error: "That passage is too short — paste at least a few sentences.",
        });
      }
      isCustomPassage = true;
      bookText = clipBookText(passageText.trim());
      if (!workTitle) workTitle = "Provided passage";
    } else if (gutenbergId) {
      // Mode 2: a Gutenberg book — fetch the raw text server-side (dodges CORS).
      bookText = await fetchBookText(gutenbergId);
      if (!bookText) {
        return res.status(404).json({
          error:
            "Couldn't retrieve the full text for this book from Project Gutenberg.",
        });
      }
    } else {
      return res.status(400).json({
        error: "Provide a book selection or paste a passage first.",
      });
    }

    // Ask Claude to write the questions in our exact structured shape
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: QUESTION_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            title: workTitle,
            author: workAuthor,
            grade,
            num,
            bookText,
            isCustomPassage,
          }),
        },
      ],
    });

    const final = await stream.finalMessage();
    const textBlock = final.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("Model returned no text block.");

    const parsed = JSON.parse(textBlock.text);
    res.json({
      title: workTitle,
      author: workAuthor,
      gradeLevel: grade,
      questions: parsed.questions || [],
    });
  } catch (err) {
    console.error("generate error:", err);
    const msg =
      err && err.status === 401
        ? "The server's Anthropic API key is missing or invalid."
        : "Something went wrong generating questions. Please try again.";
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Reading Comprehension Generator running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY is not set — generation will fail until you set it.");
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Gutendex `formats` is a map of MIME type -> URL. Pick a usable plain-text one.
function pickPlainTextUrl(formats) {
  if (!formats) return null;
  const keys = Object.keys(formats);
  const key = keys.find(
    (k) => k.startsWith("text/plain") && !formats[k].endsWith(".zip")
  );
  return key ? formats[key] : null;
}

async function fetchBookText(gutenbergId) {
  // Re-query Gutendex for this book's format URLs (cheap, and keeps the
  // frontend from having to pass long URLs around).
  const meta = await fetch(`https://gutendex.com/books/${gutenbergId}`);
  if (!meta.ok) return null;
  const book = await meta.json();
  const textUrl = pickPlainTextUrl(book.formats);
  if (!textUrl) return null;

  const resp = await fetch(textUrl);
  if (!resp.ok) return null;
  const raw = await resp.text();
  return clipBookText(cleanGutenbergText(raw));
}

// Strip the Project Gutenberg license header/footer so the model sees the work itself.
function cleanGutenbergText(raw) {
  let text = raw;
  const start = text.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (start) text = text.slice(start.index + start[0].length);
  const end = text.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (end) text = text.slice(0, end.index);
  return text.trim();
}

function clipBookText(text) {
  if (text.length <= MAX_BOOK_CHARS) return text;
  return text.slice(0, MAX_BOOK_CHARS);
}

const SYSTEM_PROMPT = `You are an expert K-12 reading-comprehension curriculum designer. You write assessment items aligned to the California Common Core State Standards for English Language Arts (CA CCSS ELA), specifically the Reading: Literature (RL) strand.

For a given literary work and grade level, you produce comprehension questions across FOUR cognitive levels:
- Literal: facts directly stated in the text (who/what/where/when).
- Inferential: reading between the lines; cause/effect, motivation, implied meaning.
- Analytical: how the text works; theme, structure, character development, author's craft.
- Evaluative: judgment, opinion with justification, real-world connection.

Requirements for every question you generate:
1. Distribute the questions across all four levels and include at least one of each level. Roughly balance them.
2. Tag each question with the single most appropriate California Common Core ELA standard, and QUOTE the standard's actual wording — not just the code. Format it exactly as: code, an em dash, then the verbatim standard text. Example: "CCSS.ELA-LITERACY.RL.5.1 — Quote accurately from a text when explaining what the text says explicitly and when drawing inferences from the text." Choose the standard whose language genuinely matches what the question assesses (e.g. a theme question -> RL.x.2, a character/structure question -> RL.x.3 or RL.x.5, a vocabulary question -> RL.x.4), rather than reusing one code. Use the Reading: Literature (RL) strand for fiction, poetry, and drama; use Reading: Informational Text (RI) for nonfiction works. Use the grade number that matches the requested band (K-2 -> RL/RI.K, RL/RI.1, or RL/RI.2; 2-3 -> .2/.3; 3-5 -> .3/.4/.5; 5-6 -> .5/.6; 6-8 -> .6/.7/.8; 9-12 -> .9-10 and .11-12). Quote the standard text accurately for that grade.
3. Provide a concise answer key for each question.
4. Provide exactly two follow-up questions per item that extend or deepen the student's thinking.
5. Match vocabulary, sentence complexity, and conceptual demand to the requested grade level.
6. Base the questions on the actual content of the provided text. If the text is only an excerpt of a longer work, you may also draw on widely known elements of the work, but stay faithful to it.

Return the questions ordered by level: all Literal first, then Inferential, then Analytical, then Evaluative.`;

function buildUserPrompt({ title, author, grade, num, bookText, isCustomPassage }) {
  const byline = author ? ` by ${author}` : "";

  if (isCustomPassage) {
    const from = title && title !== "Provided passage" ? ` from "${title}"${byline}` : "";
    return `Generate ${num} reading-comprehension questions for grade ${grade} students based on the following passage${from}.

Base the questions strictly on this passage — do not rely on outside knowledge of the work:

--- BEGIN PASSAGE ---
${bookText}
--- END PASSAGE ---`;
  }

  return `Generate ${num} reading-comprehension questions for grade ${grade} students about the book "${title}"${byline}.

Use the text below (it may be the opening portion of a longer work) as the basis for the questions:

--- BEGIN TEXT ---
${bookText}
--- END TEXT ---`;
}

// JSON Schema matching the hand-authored structure from the original app:
// each question has { type, standard, q, a, f[] }.
const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["Literal", "Inferential", "Analytical", "Evaluative"],
          },
          standard: { type: "string" },
          q: { type: "string" },
          a: { type: "string" },
          f: { type: "array", items: { type: "string" } },
        },
        required: ["type", "standard", "q", "a", "f"],
      },
    },
  },
  required: ["questions"],
};
