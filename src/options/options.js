const BLOCKED_DOMAINS_KEY = "blockedDomains";
const CONTINUE_COOLDOWN_SECONDS_KEY = "continueCooldownSeconds";
const DEFAULT_CONTINUE_COOLDOWN_SECONDS = 5;
const MIN_CONTINUE_COOLDOWN_SECONDS = 0;
const MAX_CONTINUE_COOLDOWN_SECONDS = 60;

const domainInput = document.getElementById("domainInput");
const addDomainButton = document.getElementById("addDomainButton");
const cooldownSecondsInput = document.getElementById("cooldownSecondsInput");
const saveCooldownButton = document.getElementById("saveCooldownButton");
const domainList = document.getElementById("domainList");
const feedback = document.getElementById("feedback");

function sanitizeCooldownSeconds(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONTINUE_COOLDOWN_SECONDS;
  }

  const rounded = Math.round(parsed);
  if (rounded < MIN_CONTINUE_COOLDOWN_SECONDS) {
    return MIN_CONTINUE_COOLDOWN_SECONDS;
  }

  if (rounded > MAX_CONTINUE_COOLDOWN_SECONDS) {
    return MAX_CONTINUE_COOLDOWN_SECONDS;
  }

  return rounded;
}

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

async function getDomains() {
  const data = await chrome.storage.local.get(BLOCKED_DOMAINS_KEY);
  const domains = Array.isArray(data[BLOCKED_DOMAINS_KEY]) ? data[BLOCKED_DOMAINS_KEY] : [];
  return [...new Set(domains.map(normalizeDomain).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function saveDomains(domains) {
  await chrome.storage.local.set({ [BLOCKED_DOMAINS_KEY]: domains });
}

async function getContinueCooldownSeconds() {
  const data = await chrome.storage.local.get(CONTINUE_COOLDOWN_SECONDS_KEY);
  return sanitizeCooldownSeconds(data[CONTINUE_COOLDOWN_SECONDS_KEY]);
}

async function saveContinueCooldownSeconds(seconds) {
  const sanitizedSeconds = sanitizeCooldownSeconds(seconds);
  await chrome.storage.local.set({ [CONTINUE_COOLDOWN_SECONDS_KEY]: sanitizedSeconds });
  return sanitizedSeconds;
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle("error", isError);
}

function createDomainItem(domain) {
  const item = document.createElement("li");
  item.className = "domain-item";

  const name = document.createElement("span");
  name.className = "domain-name";
  name.textContent = domain;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", async () => {
    const domains = await getDomains();
    const nextDomains = domains.filter((entry) => entry !== domain);
    await saveDomains(nextDomains);
    await renderDomains();
    setFeedback(`Done, we removed ${domain} from your list.`);
  });

  item.appendChild(name);
  item.appendChild(removeButton);
  return item;
}

async function renderDomains() {
  const domains = await getDomains();
  domainList.textContent = "";

  if (!domains.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "You have not added any domains yet. Start with one that distracts you often.";
    domainList.appendChild(empty);
    return;
  }

  domains.forEach((domain) => {
    domainList.appendChild(createDomainItem(domain));
  });
}

async function addDomain() {
  const normalized = normalizeDomain(domainInput.value);

  if (!normalized) {
    setFeedback("Enter a valid domain, for example: youtube.com", true);
    return;
  }

  const domains = await getDomains();
  if (domains.includes(normalized)) {
    setFeedback("That domain is already in your list.", true);
    return;
  }

  const nextDomains = [...domains, normalized].sort((a, b) => a.localeCompare(b));
  await saveDomains(nextDomains);

  domainInput.value = "";
  await renderDomains();
  setFeedback(`Great, we saved ${normalized}.`);
}

async function renderCooldownSetting() {
  const seconds = await getContinueCooldownSeconds();
  cooldownSecondsInput.value = String(seconds);
}

async function saveCooldownSetting() {
  const rawValue = cooldownSecondsInput.value;
  const savedSeconds = await saveContinueCooldownSeconds(rawValue);
  cooldownSecondsInput.value = String(savedSeconds);
  setFeedback(`Continue cooldown updated to ${savedSeconds} second${savedSeconds === 1 ? "" : "s"}.`);
}

addDomainButton.addEventListener("click", () => {
  addDomain().catch(() => {
    setFeedback("We could not save the domain. Please try again.", true);
  });
});

domainInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDomainButton.click();
  }
});

saveCooldownButton.addEventListener("click", () => {
  saveCooldownSetting().catch(() => {
    setFeedback("We could not save the cooldown right now. Please try again.", true);
  });
});

cooldownSecondsInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveCooldownButton.click();
  }
});

renderDomains().catch(() => {
  setFeedback("We could not load your domains right now.", true);
});

renderCooldownSetting().catch(() => {
  setFeedback("We could not load the cooldown setting right now.", true);
});
