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
  removeButton.textContent = "Eliminar";

  removeButton.addEventListener("click", async () => {
    const domains = await getDomains();
    const nextDomains = domains.filter((entry) => entry !== domain);
    await saveDomains(nextDomains);
    await renderDomains();
    setFeedback(`Listo, quitamos ${domain} de tu lista.`);
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
    empty.textContent = "Aun no agregaste dominios. Puedes empezar con uno que te distraiga seguido.";
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
    setFeedback("Escribe un dominio valido, por ejemplo: youtube.com", true);
    return;
  }

  const domains = await getDomains();
  if (domains.includes(normalized)) {
    setFeedback("Ese dominio ya esta en tu lista.", true);
    return;
  }

  const nextDomains = [...domains, normalized].sort((a, b) => a.localeCompare(b));
  await saveDomains(nextDomains);

  domainInput.value = "";
  await renderDomains();
  setFeedback(`Perfecto, guardamos ${normalized}.`);
}

addDomainButton.addEventListener("click", () => {
  addDomain().catch(() => {
    setFeedback("No pudimos guardar el dominio. Intentalo otra vez.", true);
  });
});

domainInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDomainButton.click();
  }
});

renderDomains().catch(() => {
  setFeedback("No pudimos cargar tus dominios por ahora.", true);
});
