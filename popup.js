const DEFAULT_SETTINGS = {
  enabled: true,
  keywords: [],
  matchMode: "contains",
  hideMode: "hide"
};

const elements = {
  enabled: document.getElementById("enabled"),
  status: document.getElementById("status"),
  keywordInput: document.getElementById("keywordInput"),
  addKeyword: document.getElementById("addKeyword"),
  keywordList: document.getElementById("keywordList"),
  emptyState: document.getElementById("emptyState"),
  clearAll: document.getElementById("clearAll"),
  matchMode: document.getElementById("matchMode"),
  hideMode: document.getElementById("hideMode")
};

let settings = { ...DEFAULT_SETTINGS };

function normalizeKeywords(keywords) {
  return [...new Set(
    (keywords || [])
      .map((keyword) => keyword.trim())
      .filter(Boolean)
  )];
}

async function saveSettings(patch) {
  settings = {
    ...settings,
    ...patch
  };
  settings.keywords = normalizeKeywords(settings.keywords);
  await chrome.storage.sync.set(settings);
  render();
}

function render() {
  elements.enabled.checked = settings.enabled;
  elements.matchMode.value = settings.matchMode;
  elements.hideMode.value = settings.hideMode;
  elements.status.textContent = settings.enabled
    ? `已启用，${settings.keywords.length} 个关键词`
    : `已暂停，${settings.keywords.length} 个关键词`;

  elements.keywordList.replaceChildren();
  elements.emptyState.hidden = settings.keywords.length > 0;

  for (const keyword of settings.keywords) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const remove = document.createElement("button");

    label.className = "keyword-text";
    label.textContent = keyword;

    remove.className = "remove";
    remove.type = "button";
    remove.title = `移除 ${keyword}`;
    remove.setAttribute("aria-label", `移除 ${keyword}`);
    remove.textContent = "X";
    remove.addEventListener("click", () => {
      saveSettings({
        keywords: settings.keywords.filter((itemKeyword) => itemKeyword !== keyword)
      });
    });

    item.append(label, remove);
    elements.keywordList.append(item);
  }
}

async function addKeyword() {
  const keyword = elements.keywordInput.value.trim();

  if (!keyword) {
    return;
  }

  await saveSettings({
    keywords: normalizeKeywords([...settings.keywords, keyword])
  });
  elements.keywordInput.value = "";
  elements.keywordInput.focus();
}

elements.enabled.addEventListener("change", () => {
  saveSettings({ enabled: elements.enabled.checked });
});

elements.matchMode.addEventListener("change", () => {
  saveSettings({ matchMode: elements.matchMode.value });
});

elements.hideMode.addEventListener("change", () => {
  saveSettings({ hideMode: elements.hideMode.value });
});

elements.addKeyword.addEventListener("click", addKeyword);

elements.keywordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addKeyword();
  }
});

elements.clearAll.addEventListener("click", () => {
  saveSettings({ keywords: [] });
});

(async function init() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    keywords: normalizeKeywords(stored.keywords)
  };
  render();
})();
