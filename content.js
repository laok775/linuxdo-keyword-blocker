const DEFAULT_SETTINGS = {
  enabled: true,
  keywords: [],
  matchMode: "contains",
  hideMode: "hide"
};

let settings = { ...DEFAULT_SETTINGS };
let observer = null;
let scanTimer = null;

const TOPIC_SELECTORS = [
  "tr.topic-list-item",
  ".latest-topic-list-item",
  ".topic-list-item",
  ".topic-post",
  "[data-topic-id]"
].join(",");

const TITLE_SELECTORS = [
  ".title",
  ".main-link a",
  ".topic-title",
  ".raw-topic-link",
  "a.title",
  "a[href^='/t/']"
].join(",");

function normalizeText(value) {
  return String(value || "").toLocaleLowerCase();
}

function normalizeKeywords(keywords) {
  return [...new Set(
    (keywords || [])
      .map((keyword) => keyword.trim())
      .filter(Boolean)
  )];
}

function getTopicText(topic) {
  const title = topic.querySelector(TITLE_SELECTORS)?.textContent || "";
  const aria = topic.getAttribute("aria-label") || "";
  const category = topic.querySelector(".category-name")?.textContent || "";
  const tags = [...topic.querySelectorAll(".discourse-tag, .tag-wrapper")]
    .map((tag) => tag.textContent)
    .join(" ");
  const excerpt = topic.querySelector(".topic-excerpt, .excerpt")?.textContent || "";
  const focusedText = [title, aria, category, tags, excerpt].join(" ");

  return normalizeText(focusedText.trim() || topic.textContent);
}

function keywordMatches(text, keyword) {
  const normalizedKeyword = normalizeText(keyword);

  if (settings.matchMode === "wholeWord") {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, "u").test(text);
  }

  return text.includes(normalizedKeyword);
}

function findMatchedKeyword(topic) {
  const topicText = getTopicText(topic);
  return settings.keywords.find((keyword) => keywordMatches(topicText, keyword));
}

function markVisible(topic) {
  topic.classList.remove("linuxdo-keyword-blocker-hidden", "linuxdo-keyword-blocker-dimmed");
  topic.removeAttribute("data-linuxdo-keyword-blocker-match");
}

function markBlocked(topic, keyword) {
  topic.dataset.linuxdoKeywordBlockerMatch = keyword;
  topic.classList.toggle("linuxdo-keyword-blocker-hidden", settings.hideMode === "hide");
  topic.classList.toggle("linuxdo-keyword-blocker-dimmed", settings.hideMode === "dim");
}

function scanTopics() {
  if (!settings.enabled || settings.keywords.length === 0) {
    document.querySelectorAll(TOPIC_SELECTORS).forEach(markVisible);
    return;
  }

  document.querySelectorAll(TOPIC_SELECTORS).forEach((topic) => {
    const matchedKeyword = findMatchedKeyword(topic);

    if (matchedKeyword) {
      markBlocked(topic, matchedKeyword);
    } else {
      markVisible(topic);
    }
  });
}

function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(scanTopics, 100);
}

function injectStyles() {
  if (document.getElementById("linuxdo-keyword-blocker-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "linuxdo-keyword-blocker-style";
  style.textContent = `
    .linuxdo-keyword-blocker-hidden {
      display: none !important;
    }

    .linuxdo-keyword-blocker-dimmed {
      opacity: 0.18 !important;
      filter: grayscale(1);
    }

    .linuxdo-keyword-blocker-dimmed:hover {
      opacity: 0.75 !important;
      filter: none;
    }
  `;
  document.documentElement.appendChild(style);
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    keywords: normalizeKeywords(stored.keywords)
  };
}

function startObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  for (const [key, change] of Object.entries(changes)) {
    settings[key] = key === "keywords"
      ? normalizeKeywords(change.newValue)
      : change.newValue;
  }

  scanTopics();
});

(async function init() {
  injectStyles();
  await loadSettings();
  scanTopics();
  startObserver();
})();
