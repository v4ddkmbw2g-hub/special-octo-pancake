# ✖️ Multiplication Quest

A free, **offline**, kid-friendly multiplication practice game **and** printable
worksheet maker. Everything runs in a single HTML file — no server, no accounts,
no API key, no internet required once the page is open.

> **Inspiration & originality.** This project was inspired by the general *style*
> of hands-on, number-card multiplication practice (the kind popularized by
> educators like Marcy Cook), but every problem here is **generated
> algorithmically** and all artwork, wording, branding, and layouts are original.
> No existing worksheets, problem sets, or materials are copied. See
> [On originality](#on-originality) below.

## Play it

Just open `index.html` in any modern browser — double-click the file, or host it
anywhere static (GitHub Pages, Netlify, an S3 bucket, a USB stick…). There is
**nothing to install or build.**

```
multiplication-quest/
└── index.html      ← the entire app (HTML + CSS + JS, self-contained)
```

## Four ways to play

| Mode | What kids do |
| --- | --- |
| 🃏 **Digit Drop** | Tap number cards (0–9) to build the answer to `a × b = ▯▯`. |
| 🔍 **Mystery Factor** | Find the missing number: `▯ × 7 = 42`. |
| ⚡ **Speed Run** | 60-second arcade round. Answer fast, build a streak for combo bonuses, beat your personal best. |
| 🔢 **Array Builder** | See multiplication visually as rows × columns of dots — *count* an array, or *build* one with steppers. |

Plus 🖨️ **Worksheet Maker** — generate a printable practice sheet (standard,
missing-factor, or a mix) with an optional answer key, then **Print** or
**Save as PDF**.

## Features

- **100% client-side & offline.** Pure HTML/CSS/JavaScript, zero dependencies.
- **Customizable practice.** Pick exactly which times tables (1–12), the biggest
  second factor, and an Easy/Medium/Hard difficulty (⚙️ Settings). Choices are
  saved in your browser.
- **Reward system.** Earn ⭐ stars across modes; Speed Run tracks a personal best.
  Stored locally in `localStorage`.
- **Printable worksheets** with a clean print layout and a separate answer-key
  page.
- **Shareable links.** Every worksheet has a “Copy share link” button. The link
  encodes the settings **and a random seed**, so anyone who opens it gets the
  *exact same* worksheet — great for a teacher handing the same sheet to a class,
  or sharing online. (Reproducibility is powered by a seeded random generator.)

## How it works (for the curious)

- Problems come from a small **math engine**: it picks a factor from your chosen
  tables, a second factor up to your chosen max, and computes the product. The
  difficulty setting decides whether the product or one of the factors is hidden.
- Speed Run’s multiple-choice **distractors** are generated near the correct
  answer (off-by-a-row, off-by-one, swapped factors) so wrong answers feel
  plausible, not random.
- The Worksheet Maker routes all its randomness through a **seeded PRNG**
  (`mulberry32`). The seed travels in the share link, which is why the same link
  always reproduces the same sheet.

## On originality

This app is intentionally built so its output is **never a copy** of anyone’s
materials:

- All problems are **procedurally generated** at runtime — there is no bundled
  question bank lifted from any source.
- The name, color scheme, on-screen copy, mode names (“Digit Drop”, “Mystery
  Factor”, etc.), and visual design are **original** to this project.
- It uses the generic, non-protectable *idea* of number-card / missing-number
  multiplication practice. Ideas and teaching methods aren’t copyrightable; only
  specific expression is — and none of that is reused here.

If you publish or extend this, keep new content original too, and don’t use any
third party’s name or brand to describe it.

## License / use

Made for home and classroom practice. Use it, print it, share the links, fork it.
