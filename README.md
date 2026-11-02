# qsimeon.github.io

Personal academic website of **Quilee Simeon** — research engineer working at the intersection of
machine learning, neuroscience, and scientific computing.

**Live site:** <https://qsimeon.github.io/>

Jekyll site built on the [Academic Pages](https://github.com/academicpages/academicpages.github.io)
template (itself derived from [Minimal Mistakes](https://mmistakes.github.io/minimal-mistakes/)),
served by GitHub Pages from the `master` branch.

## Running locally

Requires Ruby (see `.ruby-version`, currently 3.2.4) and Bundler.

```bash
bundle install
bundle exec jekyll serve --livereload
```

The site is then at <http://localhost:4000>. Always use `bundle exec` so the pinned
`github-pages` gem — which mirrors what GitHub Pages actually runs — is the version building
your preview. To check a build without serving: `bundle exec jekyll build`.

`Gemfile.lock` is gitignored; if `bundle install` fails, delete it and retry.

## Where content lives

| Path | Contents |
|------|----------|
| `_posts/` | Blog posts (`YYYY-MM-DD-slug.md`) |
| `_pages/` | Standalone pages — about (`/`), CV, publications, talks, teaching |
| `_publications/`, `_talks/`, `_portfolio/`, `_teaching/` | Collection entries, one file each |
| `_data/navigation.yml` | Top navigation menu |
| `_config.yml` | Site-wide config: title, author, social links, collections |
| `images/`, `files/` | Images and downloadable assets (PDFs, slides) |
| `_sass/`, `assets/` | Styles, including the dark-mode overrides |
| `_archive/` | Retired posts and standalone pages — not built (Jekyll skips `_`-prefixed dirs) |

## Conventions worth knowing

- **Hero images take a bare filename.** `header.image: driftpak-team.jpg`, *not*
  `/images/driftpak-team.jpg` — `_includes/page__hero.html` and `_includes/seo.html` prepend
  `/images/` themselves, so a path produces the broken `/images//images/...`.
- **Dark mode follows the OS.** The editorial theme lives inside a
  `@media (prefers-color-scheme: dark)` block in `_sass/`. Sass `@extend` cannot cross a
  `@media` boundary — use a combined selector instead, or the build fails.
- **The `*-template.md` pages are upstream reference copies** and are marked `published: false`.
  They declare the same permalinks as the real `about.md` / `cv.md`; publishing them makes the
  live page depend on Jekyll's file write order.
- **Long-form HTML posts** (`letting-go.html`, `brainstorm_bci_blog.html`) are hand-styled
  standalone pages at the repo root, linked from their Markdown counterparts in `_posts/`.

## Template tooling

`markdown_generator/` and `talkmap.py` are Academic Pages utilities for generating publication
and talk entries from TSV files. Unused here, kept from the template.

## License

MIT — see `LICENSE`.
