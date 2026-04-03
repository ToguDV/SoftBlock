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
    overlay.style.background = "radial-gradient(circle at 20% 10%, rgba(89, 45, 156, 0.35) 0%, rgba(5, 4, 10, 0.82) 55%, rgba(5, 4, 10, 0.88) 100%)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.backdropFilter = "blur(5px)";
    overlay.style.padding = "16px";

    const panel = document.createElement("div");
    panel.style.width = "min(460px, 100%)";
    panel.style.background = "linear-gradient(160deg, #1b1231 0%, #120c24 100%)";
    panel.style.color = "#f5f1ff";
    panel.style.border = "1px solid rgba(184, 147, 255, 0.45)";
    panel.style.borderRadius = "18px";
    panel.style.padding = "22px";
    panel.style.fontFamily = "Poppins, Nunito Sans, Trebuchet MS, sans-serif";
    panel.style.boxShadow = "0 30px 70px rgba(0,0,0,0.5)";

    const title = document.createElement("h2");
    title.textContent = "Pausa consciente";
    title.style.margin = "0 0 10px";
    title.style.fontSize = "24px";
    title.style.letterSpacing = "0.01em";

    const subtitle = document.createElement("p");
    subtitle.textContent = `Estas por entrar a ${domain}, que esta en tu lista de pausa.`;
    subtitle.style.margin = "0 0 16px";
    subtitle.style.lineHeight = "1.4";
    subtitle.style.color = "#d4c8ee";

    const selectLabel = document.createElement("label");
    selectLabel.textContent = "Si decides continuar, volver a preguntar en:";
    selectLabel.style.display = "block";
    selectLabel.style.marginBottom = "6px";
    selectLabel.style.fontSize = "14px";

    const select = document.createElement("select");
    select.style.width = "100%";
    select.style.padding = "10px";
    select.style.borderRadius = "10px";
    select.style.border = "1px solid rgba(184, 147, 255, 0.5)";
    select.style.background = "rgba(11, 8, 24, 0.8)";
    select.style.color = "#f5f1ff";
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
    continueButton.style.background = "linear-gradient(150deg, #c39dff 0%, #8b5cf6 100%)";
    continueButton.style.color = "#160b28";
    continueButton.style.border = "none";
    continueButton.style.borderRadius = "10px";
    continueButton.style.cursor = "pointer";
    continueButton.style.fontWeight = "600";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cerrar pestana";
    cancelButton.style.flex = "1";
    cancelButton.style.padding = "11px";
    cancelButton.style.background = "linear-gradient(140deg, #ff95ac 0%, #f16887 100%)";
    cancelButton.style.color = "#290613";
    cancelButton.style.border = "none";
    cancelButton.style.borderRadius = "10px";
    cancelButton.style.cursor = "pointer";
    cancelButton.style.fontWeight = "600";

    const hint = document.createElement("p");
    hint.textContent = "Elige una opcion para continuar con claridad.";
    hint.style.margin = "12px 0 0";
    hint.style.fontSize = "13px";
    hint.style.color = "#ac9acb";

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
      cancelButton.textContent = "Cerrando...";
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
