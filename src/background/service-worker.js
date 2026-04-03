const BLOCKED_DOMAINS_KEY = "blockedDomains";
const ALLOWANCES_KEY = "allowances";
const ALLOWED_MINUTES = [1, 5, 15, 30];
const DEFAULT_MINUTES = 5;
const ALARM_PREFIX = "softblock";

let blockedDomains = [];
let allowances = {};

function normalizeDomain(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return "";
  }

  const trimmed = rawValue.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.hostname.replace(/\.$/, "");
  } catch {
    return "";
  }
}

function getHostname(urlValue) {
  try {
    const parsed = new URL(urlValue);
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isHttpUrl(urlValue) {
  return typeof urlValue === "string" && (urlValue.startsWith("http://") || urlValue.startsWith("https://"));
}

function findMatchedDomain(hostname) {
  if (!hostname) {
    return null;
  }

  const matches = blockedDomains.filter((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (!matches.length) {
    return null;
  }

  // Prefer the most specific domain if several entries match.
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}

function allowanceKey(tabId, domain) {
  return `${tabId}:${domain}`;
}

function alarmName(tabId, domain) {
  return `${ALARM_PREFIX}:${tabId}:${domain}`;
}

async function saveAllowances() {
  await chrome.storage.local.set({ [ALLOWANCES_KEY]: allowances });
}

async function loadState() {
  const data = await chrome.storage.local.get([BLOCKED_DOMAINS_KEY, ALLOWANCES_KEY]);

  const loadedDomains = Array.isArray(data[BLOCKED_DOMAINS_KEY]) ? data[BLOCKED_DOMAINS_KEY] : [];
  blockedDomains = [...new Set(loadedDomains.map(normalizeDomain).filter(Boolean))];

  const loadedAllowances = data[ALLOWANCES_KEY] && typeof data[ALLOWANCES_KEY] === "object"
    ? data[ALLOWANCES_KEY]
    : {};
  allowances = loadedAllowances;

  await pruneExpiredAllowances();
}

async function pruneExpiredAllowances() {
  const now = Date.now();
  let changed = false;

  for (const [key, expiresAt] of Object.entries(allowances)) {
    if (typeof expiresAt !== "number" || expiresAt <= now) {
      delete allowances[key];
      changed = true;
    }
  }

  if (changed) {
    await saveAllowances();
  }
}

function isAllowanceActive(tabId, domain) {
  const key = allowanceKey(tabId, domain);
  const expiresAt = allowances[key];

  if (typeof expiresAt !== "number") {
    return false;
  }

  if (expiresAt <= Date.now()) {
    delete allowances[key];
    saveAllowances().catch(() => {});
    return false;
  }

  return true;
}

async function setAllowance(tabId, domain, minutes) {
  const safeMinutes = ALLOWED_MINUTES.includes(minutes) ? minutes : DEFAULT_MINUTES;
  const expiresAt = Date.now() + safeMinutes * 60 * 1000;
  const key = allowanceKey(tabId, domain);

  allowances[key] = expiresAt;
  await saveAllowances();

  chrome.alarms.create(alarmName(tabId, domain), { when: expiresAt });
}

async function removeAllowancesForTab(tabId) {
  let changed = false;

  for (const key of Object.keys(allowances)) {
    if (key.startsWith(`${tabId}:`)) {
      delete allowances[key];
      changed = true;
    }
  }

  if (changed) {
    await saveAllowances();
  }
}

async function sendShowPrompt(tabId, domain) {
  const payload = {
    type: "SOFTBLOCK_SHOW",
    domain,
    allowedMinutes: ALLOWED_MINUTES,
    defaultMinutes: DEFAULT_MINUTES
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, payload);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function evaluateTab(tabId, urlValue) {
  if (!isHttpUrl(urlValue)) {
    return;
  }

  const hostname = getHostname(urlValue);
  const matchedDomain = findMatchedDomain(hostname);

  if (!matchedDomain) {
    return;
  }

  if (isAllowanceActive(tabId, matchedDomain)) {
    return;
  }

  await sendShowPrompt(tabId, matchedDomain);
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([BLOCKED_DOMAINS_KEY, ALLOWANCES_KEY]);

  if (!Array.isArray(current[BLOCKED_DOMAINS_KEY])) {
    await chrome.storage.local.set({ [BLOCKED_DOMAINS_KEY]: [] });
  }

  if (!current[ALLOWANCES_KEY] || typeof current[ALLOWANCES_KEY] !== "object") {
    await chrome.storage.local.set({ [ALLOWANCES_KEY]: {} });
  }

  await loadState();
});

chrome.runtime.onStartup.addListener(() => {
  loadState().catch(() => {});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[BLOCKED_DOMAINS_KEY]) {
    const nextDomains = Array.isArray(changes[BLOCKED_DOMAINS_KEY].newValue)
      ? changes[BLOCKED_DOMAINS_KEY].newValue
      : [];
    blockedDomains = [...new Set(nextDomains.map(normalizeDomain).filter(Boolean))];
  }

  if (changes[ALLOWANCES_KEY]) {
    const nextAllowances = changes[ALLOWANCES_KEY].newValue && typeof changes[ALLOWANCES_KEY].newValue === "object"
      ? changes[ALLOWANCES_KEY].newValue
      : {};
    allowances = nextAllowances;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const candidateUrl = changeInfo.url || tab.url;
  if (!candidateUrl) {
    return;
  }

  evaluateTab(tabId, candidateUrl).catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      await evaluateTab(tabId, tab.url);
    }
  } catch {
    // Tab may no longer exist.
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  evaluateTab(details.tabId, details.url).catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage().catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeAllowancesForTab(tabId).catch(() => {});
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const match = new RegExp(`^${ALARM_PREFIX}:(\\d+):(.+)$`).exec(alarm.name);
  if (!match) {
    return;
  }

  const tabId = Number(match[1]);
  const domain = match[2];

  delete allowances[allowanceKey(tabId, domain)];
  await saveAllowances();

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      return;
    }

    const hostname = getHostname(tab.url);
    const stillInDomain = hostname === domain || hostname.endsWith(`.${domain}`);

    if (stillInDomain) {
      await sendShowPrompt(tabId, domain);
    }
  } catch {
    // Tab may have been closed.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== "string") {
      return;
    }

    if (message.type === "SOFTBLOCK_PAGE_READY") {
      const tabId = sender.tab?.id;
      if (typeof tabId === "number" && typeof message.url === "string") {
        await evaluateTab(tabId, message.url);
      }
      return;
    }

    if (message.type === "SOFTBLOCK_CONTINUE") {
      const tabId = sender.tab?.id;
      const domain = normalizeDomain(message.domain);
      const minutes = Number(message.minutes);

      if (typeof tabId === "number" && domain) {
        await setAllowance(tabId, domain, minutes);
        sendResponse({ ok: true });
      }
      return;
    }

    if (message.type === "SOFTBLOCK_CANCEL") {
      const tabId = sender.tab?.id;
      if (typeof tabId === "number") {
        await chrome.tabs.remove(tabId);
      }
      return;
    }
  })().catch(() => {
    sendResponse({ ok: false });
  });

  return true;
});

loadState().catch(() => {});
