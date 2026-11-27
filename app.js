const form = document.querySelector("#audit-form");
const usernameInput = document.querySelector("#username");
const button = document.querySelector("#audit-button");
const notice = document.querySelector("#notice");
const results = document.querySelector("#results");

const API = "https://api.github.com";
const MAX_REPOS = 6;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function normalizeUsername(value) {
  return value.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "");
}

async function githubJson(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (response.status === 404) throw new Error("We couldn't find that GitHub user. Check the spelling and try again.");
  if (response.status === 403) throw new Error("GitHub's public API rate limit was reached. Try again in about an hour.");
  if (!response.ok) throw new Error(`GitHub returned an error (${response.status}). Please try again shortly.`);
  return response.json();
}

async function readmeLength(owner, repo) {
  try {
    const readme = await githubJson(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`);
    if (!readme.content) return 0;
    const decoded = atob(readme.content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes).trim().length;
  } catch (error) {
    if (error.message.includes("rate limit")) throw error;
    return 0;
  }
}

function ageInDays(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function projectSignals(repo, length) {
  const age = ageInDays(repo.updated_at);
  const checks = [
    { key: "Clear description", points: repo.description ? 20 : 0, max: 20 },
    { key: "Useful README", points: length >= 400 ? 25 : length >= 120 ? 16 : length > 0 ? 8 : 0, max: 25 },
    { key: "Open source license", points: repo.license ? 15 : 0, max: 15 },
    { key: "Searchable topics", points: repo.topics?.length >= 2 ? 15 : repo.topics?.length === 1 ? 8 : 0, max: 15 },
    { key: "Recent activity", points: age <= 180 ? 15 : age <= 365 ? 8 : age <= 730 ? 2 : 0, max: 15 },
    { key: "Project link", points: repo.homepage?.trim() ? 10 : 0, max: 10 },
  ];
  return { score: checks.reduce((sum, item) => sum + item.points, 0), checks, readmeLength: length, age };
}

function profileSignals(profile) {
  const checks = [
    { key: "Name", value: profile.name?.trim(), points: 5, max: 5 },
    { key: "Bio", value: profile.bio?.trim(), points: profile.bio?.trim().length >= 40 ? 8 : profile.bio ? 4 : 0, max: 8 },
    { key: "Location", value: profile.location?.trim(), points: 3, max: 3 },
    { key: "Portfolio or website", value: profile.blog?.trim(), points: 5, max: 5 },
    { key: "Company", value: profile.company?.trim(), points: 4, max: 4 },
  ];
  return { score: checks.reduce((sum, item) => sum + item.points, 0), checks };
}

function buildActions(profile, profileScore, projects) {
  const actions = [];
  const profileActions = {
    "Name": ["Add the name people know you by", "A real name or consistent professional name helps visitors connect your work to you."],
    "Bio": ["Write a specific one-line bio", "Say what you build, the tools you use, and what kind of work you want."],
    "Location": ["Add your location or time zone", "It helps collaborators and recruiters understand where you can work."],
    "Portfolio or website": ["Link a portfolio or one strong demo", "Give visitors a direct path from the profile to your best work."],
    "Company": ["Add a current role or affiliation", "A company or community affiliation adds useful context to your profile."],
  };
  for (const check of profileScore.checks) {
    if (!check.value) actions.push({ title: profileActions[check.key][0], detail: profileActions[check.key][1] });
  }
  const missing = new Set();
  for (const { repo, signals } of projects) {
    if (!repo.description) missing.add(`Add a one-sentence description to ${repo.name}`);
    if (!signals.readmeLength) missing.add(`Add a README to ${repo.name} with its purpose, setup, and a screenshot or example`);
    if (!repo.license) missing.add(`Choose a license for ${repo.name} so people know how they can use it`);
    if (!repo.topics?.length) missing.add(`Add GitHub topics to ${repo.name} so it is easier to discover`);
    if (!repo.homepage?.trim()) missing.add(`Link a live demo or documentation from ${repo.name} if one exists`);
  }
  for (const title of missing) {
    if (actions.length >= 5) break;
    actions.push({ title, detail: "This is a quick public signal that makes the project easier to understand or try." });
  }
  if (!actions.length) actions.push({ title: "Keep the strongest projects current", detail: "Refresh screenshots, examples, and release notes when the project changes." });
  return actions.slice(0, 5);
}

function relativeAge(days) {
  if (days < 0 || !Number.isFinite(days)) return "unknown update date";
  if (days === 0) return "updated today";
  if (days === 1) return "updated yesterday";
  if (days < 30) return `updated ${days} days ago`;
  if (days < 365) return `updated ${Math.floor(days / 30)} months ago`;
  return `updated ${Math.floor(days / 365)} years ago`;
}

function repoCard({ repo, signals }) {
  const checks = signals.checks.map(({ key, points }) => `<span class="${points ? "good" : "miss"}">${escapeHtml(key)}</span>`).join("");
  const topics = (repo.topics || []).slice(0, 3).map((topic) => `<span>${escapeHtml(topic)}</span>`).join("");
  const description = repo.description || "No description yet. A sentence about what this project does would help.";
  const language = repo.language ? `<span>${escapeHtml(repo.language)}</span>` : "";
  return `<article class="repo-card">
    <div class="repo-card-head"><h4><a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(repo.name)} ↗</a></h4><span class="repo-score">${signals.score}/100</span></div>
    <p>${escapeHtml(description)}</p>
    <div class="repo-tags">${language}${topics}<span>${relativeAge(signals.age)}</span></div>
    <div class="repo-checks">${checks}</div>
  </article>`;
}

function reportMarkdown(username, overall, profileScore, projects, actions) {
  const lines = [
    `# FirstLook profile audit: @${username}`,
    "",
    `**First impression score: ${overall}/100**  `,
    `Profile basics: ${profileScore.score}/${profileScore.checks.reduce((sum, item) => sum + item.max, 0)} · Projects reviewed: ${projects.length}`,
    "",
    "## Strongest public projects",
    ...projects.map(({ repo, signals }) => `- [${repo.name}](${repo.html_url}) — ${signals.score}/100${repo.description ? `: ${repo.description}` : ""}`),
    "",
    "## Recommended next steps",
    ...actions.map((action, index) => `${index + 1}. **${action.title}** — ${action.detail}`),
    "",
    "_Generated by FirstLook. This is a transparent portfolio checklist, not a hiring prediction._",
  ];
  return lines.join("\n");
}

function renderResults(profile, profileScore, projects, overall) {
  const actions = buildActions(profile, profileScore, projects);
  results.innerHTML = `
    <div class="result-head">
      <div><p class="eyebrow">FIRST IMPRESSION AUDIT</p><h2>${escapeHtml(profile.name || profile.login)} <span>@${escapeHtml(profile.login)}</span></h2><p>Public GitHub signals · ${projects.length} ${projects.length === 1 ? "project" : "projects"} reviewed</p></div>
      <div class="result-actions"><button id="copy-link" type="button">Copy audit link</button><button id="download-report" type="button">Download report</button></div>
    </div>
    <div class="result-grid">
      <aside class="score-panel"><div class="score-ring" style="--score:${overall * 1}%"><div class="score-value">${overall}<small>/100</small></div></div><div class="score-meta"><div class="score-caption">FIRSTLOOK SCORE</div><p class="profile-score-meta">Profile basics ${profileScore.score}/25<br />Project signals ${projects.length ? Math.round(projects.reduce((sum, item) => sum + item.signals.score, 0) / projects.length) : 0}/100 avg.</p></div></aside>
      <section class="detail-panel"><h3>Your highest-impact next steps</h3><ol class="actions-list">${actions.map((action, index) => `<li><span class="priority">${index + 1}</span><span><b>${escapeHtml(action.title)}</b><br />${escapeHtml(action.detail)}</span></li>`).join("")}</ol></section>
    </div>
    <section class="repo-section"><div class="repo-section-heading"><h3>Project signals</h3><span>RECENT ORIGINAL REPOSITORIES</span></div><div class="repo-grid">${projects.length ? projects.map(repoCard).join("") : `<div class="detail-panel"><p>No public non-fork repositories found yet. Pin a project and give it a README to start telling the story.</p></div>`}</div><p class="data-note">Scores use public metadata and README length only. We don’t read source code, private repositories, profile pins, or contribution history.</p></section>`;
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });

  document.querySelector("#copy-link").addEventListener("click", async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("u", profile.login);
    try {
      await navigator.clipboard.writeText(url.toString());
      notice.textContent = "Audit link copied.";
    } catch {
      notice.textContent = `Share this link: ${url.toString()}`;
    }
  });
  document.querySelector("#download-report").addEventListener("click", () => {
    const content = reportMarkdown(profile.login, overall, profileScore, projects, actions);
    const blobUrl = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `firstlook-${profile.login}.md`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  });
}

async function audit(username) {
  const profile = await githubJson(`/users/${encodeURIComponent(username)}`);
  const repos = await githubJson(`/users/${encodeURIComponent(profile.login)}/repos?type=owner&sort=updated&direction=desc&per_page=100`);
  const selected = repos.filter((repo) => !repo.fork && !repo.archived).slice(0, MAX_REPOS);
  let nextReadme = 0;
  const lengths = await Promise.all(selected.map(async (repo, index) => {
    const myIndex = index;
    if (myIndex >= 4) {
      while (nextReadme >= 4) await new Promise((resolve) => setTimeout(resolve, 30));
    }
    nextReadme += 1;
    try { return await readmeLength(profile.login, repo.name); }
    finally { nextReadme -= 1; }
  }));
  const projects = selected.map((repo, index) => ({ repo, signals: projectSignals(repo, lengths[index]) }));
  projects.sort((left, right) => right.signals.score - left.signals.score || left.signals.age - right.signals.age);
  const profileScore = profileSignals(profile);
  const projectAverage = projects.length ? projects.reduce((sum, item) => sum + item.signals.score, 0) / projects.length : 0;
  const overall = Math.round(profileScore.score + projectAverage * 0.75);
  return { profile, profileScore, projects, overall };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = normalizeUsername(usernameInput.value);
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
    notice.textContent = "Enter a GitHub username, or paste its profile URL.";
    return;
  }
  button.disabled = true;
  button.innerHTML = "Reading public data <span aria-hidden=\"true\">…</span>";
  notice.textContent = "Checking profile basics and recent projects…";
  results.hidden = true;
  try {
    const report = await audit(username);
    const url = new URL(window.location.href);
    url.searchParams.set("u", report.profile.login);
    window.history.replaceState({}, "", url);
    notice.textContent = "";
    renderResults(report.profile, report.profileScore, report.projects, report.overall);
  } catch (error) {
    notice.textContent = error.message || "Something went wrong while reading this profile.";
  } finally {
    button.disabled = false;
    button.innerHTML = "Audit profile <span aria-hidden=\"true\">→</span>";
  }
});

const requestedUser = new URLSearchParams(window.location.search).get("u");
if (requestedUser) {
  usernameInput.value = requestedUser;
  form.requestSubmit();
}

const THEME_KEY = "firstlook-theme";
const THEME_COLORS = { light: "#f6f5ef", dark: "#111714" };
const themeToggle = document.querySelector("#theme-toggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors when localStorage is disabled or unavailable
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", THEME_COLORS[theme]);
  }
  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    const label = themeToggle.querySelector(".theme-label");
    if (label) label.textContent = isDark ? "Light" : "Dark";
  }
}

const initialTheme =
  document.documentElement.dataset.theme === "dark" || document.documentElement.dataset.theme === "light"
    ? document.documentElement.dataset.theme
    : getStoredTheme() || (darkMediaQuery.matches ? "dark" : "light");

applyTheme(initialTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    saveTheme(nextTheme);
    applyTheme(nextTheme);
  });
}

darkMediaQuery.addEventListener("change", (event) => {
  if (!getStoredTheme()) {
    applyTheme(event.matches ? "dark" : "light");
  }
});