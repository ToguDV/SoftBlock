(() => {
  const OVERLAY_ID = "softblock-overlay";

  function currentHostname() {
    try {
      return window.location.hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function notifyPageReady() {
    chrome.runtime.sendMessage({
      type: "SOFTBLOCK_PAGE_READY",
      url: window.location.href
    }).catch(() => {});
  }

  function removeOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
    }
  }

  function createOverlay({ domain, allowedMinutes, defaultMinutes }) {
    removeOverlay();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "2147483647";
    overlay.style.background = "rgba(9, 15, 33, 0.70)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.padding = "16px";

    const panel = document.createElement("div");
    panel.style.width = "min(460px, 100%)";
    panel.style.background = "#fffdf8";
    panel.style.color = "#151515";
    panel.style.border = "2px solid #1f2937";
    panel.style.borderRadius = "16px";
    panel.style.padding = "20px";
    panel.style.fontFamily = "ui-sans-serif, -apple-system, Segoe UI, sans-serif";
    panel.style.boxShadow = "0 30px 60px rgba(0,0,0,0.25)";

    const title = document.createElement("h2");
    title.textContent = "Pausa consciente";
    title.style.margin = "0 0 8px";
    title.style.fontSize = "24px";

    const subtitle = document.createElement("p");
    subtitle.textContent = `Este dominio esta en tu lista: ${domain}`;
    subtitle.style.margin = "0 0 16px";
    subtitle.style.lineHeight = "1.4";

    const selectLabel = document.createElement("label");
    selectLabel.textContent = "Si continuas, no mostrar popup durante:";
    selectLabel.style.display = "block";
    selectLabel.style.marginBottom = "6px";

    const select = document.createElement("select");
    select.style.width = "100%";
    select.style.padding = "10px";
    select.style.borderRadius = "10px";
    select.style.border = "1px solid #374151";
    select.style.marginBottom = "16px";

    allowedMinutes.forEach((minutes) => {
      const option = document.createElement("option");
      option.value = String(minutes);
      option.textContent = `${minutes} minuto${minutes === 1 ? "" : "s"}`;
      if (minutes === defaultMinutes) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "10px";

    const continueButton = document.createElement("button");
    continueButton.textContent = "Continuar";
    continueButton.style.flex = "1";
    continueButton.style.padding = "11px";
    continueButton.style.background = "#0f766e";
    continueButton.style.color = "#ffffff";
    continueButton.style.border = "none";
    continueButton.style.borderRadius = "10px";
    continueButton.style.cursor = "pointer";
    continueButton.style.fontWeight = "600";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "No continuar";
    cancelButton.style.flex = "1";
    cancelButton.style.padding = "11px";
    cancelButton.style.background = "#b91c1c";
    cancelButton.style.color = "#ffffff";
    cancelButton.style.border = "none";
    cancelButton.style.borderRadius = "10px";
    cancelButton.style.cursor = "pointer";
    cancelButton.style.fontWeight = "600";

    const hint = document.createElement("p");
    hint.textContent = "Debes elegir una opcion para continuar.";
    hint.style.margin = "12px 0 0";
    hint.style.fontSize = "13px";
    hint.style.opacity = "0.8";

    actions.appendChild(continueButton);
    actions.appendChild(cancelButton);

    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(selectLabel);
    panel.appendChild(select);
    panel.appendChild(actions);
    panel.appendChild(hint);
    overlay.appendChild(panel);

    continueButton.addEventListener("click", () => {
      const minutes = Number(select.value);
      chrome.runtime.sendMessage({
        type: "SOFTBLOCK_CONTINUE",
        domain,
        minutes
      }).catch(() => {});
      removeOverlay();
    });

    cancelButton.addEventListener("click", () => {
      cancelButton.disabled = true;
      continueButton.disabled = true;
      cancelButton.textContent = "Cerrando pestana...";
      chrome.runtime.sendMessage({ type: "SOFTBLOCK_CANCEL" }).catch(() => {});
    });

    document.documentElement.appendChild(overlay);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "SOFTBLOCK_SHOW") {
      return;
    }

    const pageHost = currentHostname();
    const expectedDomain = String(message.domain || "").toLowerCase();

    if (!pageHost || !expectedDomain) {
      return;
    }

    const stillMatching = pageHost === expectedDomain || pageHost.endsWith(`.${expectedDomain}`);
    if (!stillMatching) {
      return;
    }

    createOverlay({
      domain: expectedDomain,
      allowedMinutes: Array.isArray(message.allowedMinutes) ? message.allowedMinutes : [1, 5, 15, 30],
      defaultMinutes: Number(message.defaultMinutes) || 5
    });
  });

  window.addEventListener("popstate", notifyPageReady);
  window.addEventListener("hashchange", notifyPageReady);

  const originalPushState = history.pushState;
  history.pushState = function pushStateProxy(...args) {
    const result = originalPushState.apply(this, args);
    notifyPageReady();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function replaceStateProxy(...args) {
    const result = originalReplaceState.apply(this, args);
    notifyPageReady();
    return result;
  };

  notifyPageReady();
})();
