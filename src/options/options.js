const BLOCKED_DOMAINS_KEY = "blockedDomains";

const domainInput = document.getElementById("domainInput");
const addDomainButton = document.getElementById("addDomainButton");
const domainList = document.getElementById("domainList");
const feedback = document.getElementById("feedback");

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

renderDomains().catch(() => {
  setFeedback("We could not load your domains right now.", true);
});
