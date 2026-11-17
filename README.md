# FirstLook

**Make your work easy to believe in.** FirstLook gives a developer a transparent first-impression audit of their public GitHub profile and recent projects, then suggests a few concrete improvements.

[Repository](https://github.com/Udbhav-regadamilli/firstlook) · [Live demo](https://udbhav-regadamilli.github.io/firstlook/)

No account, token, AI score, or backend. The page reads public GitHub data in your browser and keeps the report on your device.

## Try it

Open `index.html` from a static web server, enter a GitHub username, and get a shareable scorecard plus a downloadable Markdown report.

```bash
python3 -m http.server 4173
```

Then visit [http://localhost:4173](http://localhost:4173).

You can also share an audit link with `?u=github-username`.

### Publish a live demo

The included GitHub Actions workflow deploys the static app to GitHub Pages on each push to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow only publishes `index.html`, `app.js`, and `styles.css`.

## What it checks

- Profile basics: name, bio, location, portfolio link, and company.
- Up to six of the user's most recently updated original public repositories.
- Project descriptions, README presence and length, license, topics, recent activity, and a homepage link.
- A short, prioritized list of improvements and a downloadable Markdown report.

The score uses a fixed checklist. Stars, language percentages, and private data do not affect it. The report is a portfolio checklist, not a hiring prediction.

## Privacy

FirstLook makes read-only requests from your browser to GitHub's public API. It has no application server, analytics, or account flow. It does not read source code, private repositories, profile pins, or contribution history. GitHub's API rate limits apply.

## Scoring

| Signal | Points |
| --- | ---: |
| Profile basics | 25 |
| Project descriptions | 15 |
| Useful READMEs | 18.75 |
| Open source licenses | 11.25 |
| Searchable topics | 11.25 |
| Recent activity | 11.25 |
| Project links | 7.5 |
| **Total** | **100** |

Each project receives a score out of 100. The overall score combines the profile checklist (25%) with the average project score (75%). The detailed result shows the per-project evidence behind the number.

## Contributing

Issues and pull requests are welcome. Keep checks deterministic, explain every score, and preserve the no-login, no-backend model.

## License

MIT. See [LICENSE](LICENSE).
