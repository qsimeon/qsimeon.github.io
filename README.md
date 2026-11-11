# qsimeon.github.io

Personal site of **Quilee Simeon**: Applied Scientist at Amazon FAI, previously computational
neuroscience at MIT. Live at <https://qsimeon.github.io/>.

Plain Jekyll, built by GitHub Pages from `master`. No theme gem, no Sass, no jQuery, no build step:
hand-written layouts, two CSS files, and two small vanilla JS files.

## Running locally

Requires Ruby 3.2 (the local setup uses rbenv with 3.2.4) and Bundler.

```bash
bundle install
bundle exec jekyll serve --livereload
```

The site is then at <http://localhost:4000>. Always use `bundle exec`, so the pinned `github-pages` gem
(Jekyll 3.10, the same as production) builds the preview.

## How it fits together

```
_data/cv.yml        ─┬─▶ home "Path" timeline, /cv/, /teaching/, /about/ (community)
_data/projects.yml  ─┼─▶ home bento (featured: true), /portfolio/ (work + press)
_posts/             ─┼─▶ home "Writing", /blog/, _layouts/post.html
_publications/      ─┼─▶ /publications/, /cv/, _layouts/entry.html
_talks/             ─┼─▶ /talks/, /cv/, _layouts/entry.html
_portfolio/         ─┘   entry.html pages, reached only from links in projects.yml and about.html

assets/css/tokens.css   design tokens: every color is a light-dark() pair
assets/css/site.css     everything else, in layers: reset → base → layout → components → pages → prose
assets/js/site.js       theme toggle, mobile nav, scroll reveal, card spotlight
assets/js/connectome.js the animated neural graph behind the home hero (pages opt in via `scripts:`)
```

| Path | Contents |
|------|----------|
| `_pages/` | Home (`/`), about, blog index, work (/portfolio/), publications, talks, teaching, CV, privacy (/privacy/), 404 |
| `_layouts/` | `default` (shell), `page`, `post`, `entry` (collection items) |
| `_includes/` | head, header, footer, `card`, `post-row`, `visual` (card artwork), `icon` (inline SVG) |
| `letting-go.html`, `brainstorm_bci_blog.html`, `growlab/` | Standalone showcase pages. They load `tokens.css` so they share the palette and theme |
| `files/` | Downloadables; `qsimeon_resume.pdf` is built from the LaTeX resume (public variant, no phone number) |

## Conventions worth knowing

- **Theme.** `tokens.css` sets `color-scheme: light dark`, and the inline script in `_includes/head.html` sets
  `data-theme` before first paint, so there's no flash. `light-dark()` values are *unresolved* inside custom
  properties: JS that needs a real color (e.g. canvas) must resolve it through a probe element (see `connectome.js`).
- **No Sass.** GitHub Pages runs Ruby Sass 3.7, which can't compile `clamp()`/`min()` with mixed units. The CSS files
  have no front matter and are served as-is.
- **Active nav** comes from `section` (set per page or via `defaults` in `_config.yml`) matching `_data/navigation.yml`.
- **Card artwork** (`visual:` in `projects.yml`) is an image path under `/images/`, or one of the inline drawings in
  `_includes/visual.html` (`growth`, `scaling`, `terminal`, `merge`, `forks`, `quote`).
- **Math.** Add `math: true` to a post's front matter to load MathJax on that page only.
- **Plugins** must be on the GitHub Pages whitelist: feed, sitemap, seo-tag, redirect-from.
- **Local preview** must override `url` (`bundle exec jekyll serve` does this), or pages load their CSS from production.
- **Posts that live elsewhere.** A post with `link:` in its front matter makes its card open that URL instead (`_includes/post-row.html`). Add `redirect_to:` and `sitemap: false` so the post's own URL forwards there, as `letting-go` does.
- **Résumé and CV.** `files/qsimeon_resume.pdf` comes from the public variant of the LaTeX résumé. Keep `_data/cv.yml` in sync with it by hand.
- **Voice.** Write in first person, in complete sentences. No em dashes and no semicolons in prose. State claims
  directly instead of through "not X but Y" contrasts, and use noun headings. Pages describe the work in its final
  state, without revision history or local paths. Code blocks, figures and numbers are never edited for style.

## License

MIT, see `LICENSE`.
