(() => {
  const OVERLAY_ID = "softblock-overlay";
  const OVERLAY_HOST_ID = "softblock-overlay-host";
  const DEFAULT_CONTINUE_COOLDOWN_SECONDS = 5;
  let activeCooldownInterval = null;
  let previousHtmlOverflow = "";
  let previousBodyOverflow = "";
  let isScrollLocked = false;

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

  function lockPageScroll() {
    if (isScrollLocked) {
      return;
    }

    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyOverflow = document.body ? document.body.style.overflow : "";

    document.documentElement.style.overflow = "hidden";
    if (document.body) {
      document.body.style.overflow = "hidden";
    }

    isScrollLocked = true;
  }

  function unlockPageScroll() {
    if (!isScrollLocked) {
      return;
    }

    document.documentElement.style.overflow = previousHtmlOverflow;
    if (document.body) {
      document.body.style.overflow = previousBodyOverflow;
    }

    isScrollLocked = false;
  }

  function removeOverlay() {
    if (activeCooldownInterval) {
      clearInterval(activeCooldownInterval);
      activeCooldownInterval = null;
    }

    const existing = document.getElementById(OVERLAY_HOST_ID);
    if (existing) {
      existing.remove();
    }

    unlockPageScroll();
  }

  function sanitizeCooldownSeconds(rawValue) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_CONTINUE_COOLDOWN_SECONDS;
    }

    const rounded = Math.round(parsed);
    if (rounded < 0) {
      return 0;
    }

    if (rounded > 60) {
      return 60;
    }

    return rounded;
  }

  function createOverlay({ domain, allowedMinutes, defaultMinutes, continueCooldownSeconds }) {
    removeOverlay();
    lockPageScroll();

    const host = document.createElement("div");
    host.id = OVERLAY_HOST_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";

    const shadow = host.attachShadow({ mode: "open" });

    const styles = document.createElement("style");
    styles.textContent = `
      :host {
        all: initial;
      }

      .softblock-overlay,
      .softblock-overlay * {
        box-sizing: border-box;
      }

      .softblock-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: radial-gradient(circle at 20% 10%, rgba(89, 45, 156, 0.35) 0%, rgba(5, 4, 10, 0.82) 55%, rgba(5, 4, 10, 0.88) 100%);
        backdrop-filter: blur(5px);
      }

      .softblock-panel {
        width: min(460px, 100%);
        padding: 22px;
        border: 1px solid rgba(184, 147, 255, 0.45);
        border-radius: 18px;
        background: linear-gradient(160deg, #1b1231 0%, #120c24 100%);
        color: #f5f1ff;
        font-family: Poppins, Nunito Sans, Trebuchet MS, sans-serif;
        box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
      }

      .softblock-title {
        margin: 0 0 10px;
        font-size: 24px;
        letter-spacing: 0.01em;
      }

      .softblock-subtitle {
        margin: 0 0 16px;
        line-height: 1.4;
        color: #d4c8ee;
      }

      .softblock-label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
      }

      .softblock-select {
        width: 100%;
        margin-bottom: 16px;
        padding: 10px;
        border: 1px solid rgba(184, 147, 255, 0.5);
        border-radius: 10px;
        background: rgba(11, 8, 24, 0.8);
        color: #f5f1ff;
      }

      .softblock-actions {
        display: flex;
        gap: 10px;
      }

      .softblock-button {
        flex: 1;
        padding: 11px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
      }

      .softblock-button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .softblock-button-continue {
        background: linear-gradient(150deg, #c39dff 0%, #8b5cf6 100%);
        color: #160b28;
      }

      .softblock-button-cancel {
        background: linear-gradient(140deg, #ff95ac 0%, #f16887 100%);
        color: #290613;
      }

      .softblock-countdown {
        margin: 10px 0 0;
        font-size: 13px;
        color: #cbbbe7;
      }

      .softblock-hint {
        margin: 12px 0 0;
        font-size: 13px;
        color: #ac9acb;
      }
    `;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "softblock-overlay";

    const panel = document.createElement("div");
    panel.className = "softblock-panel";

    const title = document.createElement("h2");
    title.textContent = "Mindful pause";
    title.className = "softblock-title";

    const subtitle = document.createElement("p");
    subtitle.textContent = `You are about to enter ${domain}, which is on your pause list.`;
    subtitle.className = "softblock-subtitle";

    const selectLabel = document.createElement("label");
    selectLabel.textContent = "If you decide to continue, ask again in:";
    selectLabel.className = "softblock-label";

    const select = document.createElement("select");
    select.className = "softblock-select";

    allowedMinutes.forEach((minutes) => {
      const option = document.createElement("option");
      option.value = String(minutes);
      option.textContent = `${minutes} minute${minutes === 1 ? "" : "s"}`;
      if (minutes === defaultMinutes) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    const actions = document.createElement("div");
    actions.className = "softblock-actions";

    const continueButton = document.createElement("button");
    continueButton.textContent = "Continue";
    continueButton.className = "softblock-button softblock-button-continue";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Close tab";
    cancelButton.className = "softblock-button softblock-button-cancel";

    const hint = document.createElement("p");
    hint.textContent = "Choose an option to continue with clarity.";
    hint.className = "softblock-hint";

    const countdown = document.createElement("p");
    countdown.className = "softblock-countdown";
    countdown.setAttribute("aria-live", "polite");

    const initialCooldown = sanitizeCooldownSeconds(continueCooldownSeconds);
    let remainingSeconds = initialCooldown;

    const renderCountdown = () => {
      if (remainingSeconds > 0) {
        continueButton.disabled = true;
        continueButton.textContent = "🔒 Continue";
        countdown.textContent = `Continue unlocks in ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}.`;
        return;
      }

      continueButton.disabled = false;
      continueButton.textContent = "Continue";
      countdown.textContent = "You can continue now.";
    };

    renderCountdown();
    if (remainingSeconds > 0) {
      activeCooldownInterval = window.setInterval(() => {
        remainingSeconds -= 1;
        renderCountdown();

        if (remainingSeconds <= 0 && activeCooldownInterval) {
          clearInterval(activeCooldownInterval);
          activeCooldownInterval = null;
        }
      }, 1000);
    }

    actions.appendChild(continueButton);
    actions.appendChild(cancelButton);

    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(selectLabel);
    panel.appendChild(select);
    panel.appendChild(actions);
    panel.appendChild(countdown);
    panel.appendChild(hint);
    overlay.appendChild(panel);
    shadow.appendChild(styles);
    shadow.appendChild(overlay);

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
      cancelButton.textContent = "Closing...";
      chrome.runtime.sendMessage({ type: "SOFTBLOCK_CANCEL" }).catch(() => {});
    });

    document.documentElement.appendChild(host);
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
      defaultMinutes: Number(message.defaultMinutes) || 5,
      continueCooldownSeconds: message.continueCooldownSeconds
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
