(() => {
  const STYLE_ID = "bg-text-class-inspector-style";
  const LABEL_CLASS = "bg-text-class-inspector-label";

  const PALETTE =
    "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent|current|inherit";
  const SHADE = "50|100|200|300|400|500|600|700|800|900|950";

  const STANDARD_COLOR = new RegExp(
    `^(bg|text)-(${PALETTE})(-(${SHADE}))?(/\\d{1,3})?$`
  );
  const LEGACY_OPACITY = /^(bg|text)-opacity-(\\d{1,3})$/;

  const TEXT_DENY = [
    /^text-(xs|sm|base|lg|xl|[2-9]xl)(\/[\w\[\].%+-]+)?$/,
    /^text-\[\d+(\.\d+)?(px|rem|em|%|ch|ex|lh|rlh|svw|svh|vw|vh)\](\/[\w\[\].%+-]+)?$/i,
    /^text-(left|center|right|justify|start|end)$/,
    /^text-(ellipsis|clip|wrap|nowrap|balance|pretty)$/,
    /^text-(underline|overline|line-through|no-underline)$/,
    /^text-(shadow|indent|opacity)-/,
  ];

  const BG_DENY = [
    /^bg-(fixed|local|scroll|auto|cover|contain|none)$/,
    /^bg-(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/,
    /^bg-(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top)$/,
    /^bg-(clip|origin|gradient|opacity)-/,
  ];

  let inspectorActive = false;
  let entries = [];
  let elementEntries = new WeakMap();
  let activeLabel = null;
  let scheduleUpdate = null;
  let mutationObserver = null;
  let raf = 0;

  function isArbitraryColorClass(cls) {
    const match = cls.match(/^(bg|text)-\[(.+)\]$/);
    if (!match) return false;

    const value = match[2].trim();
    return (
      /^#([0-9a-f]{3,8})$/i.test(value) ||
      /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/i.test(value) ||
      /^var\(--/.test(value)
    );
  }

  function isColorClass(cls) {
    if (STANDARD_COLOR.test(cls)) return true;
    if (LEGACY_OPACITY.test(cls)) return true;
    if (isArbitraryColorClass(cls)) return true;
    if (!/^(bg|text)-/.test(cls)) return false;

    const denies = cls.startsWith("bg-") ? BG_DENY : TEXT_DENY;
    return !denies.some((pattern) => pattern.test(cls));
  }

  function getColorClasses(el) {
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return [];
    return [...el.classList].filter(isColorClass);
  }

  function renderLabel(classes) {
    const label = document.createElement("div");
    label.className = LABEL_CLASS;

    classes.forEach((cls, index) => {
      const span = document.createElement("span");
      span.className = cls.startsWith("bg-") ? "bg" : "txt";
      span.textContent = cls;
      label.appendChild(span);
      if (index < classes.length - 1) {
        label.appendChild(document.createTextNode(" "));
      }
    });

    label.title = classes.join("\n");
    document.body.appendChild(label);
    return label;
  }

  function updateLabelContent(entry, classes) {
    entry.label.replaceChildren();
    classes.forEach((cls, index) => {
      const span = document.createElement("span");
      span.className = cls.startsWith("bg-") ? "bg" : "txt";
      span.textContent = cls;
      entry.label.appendChild(span);
      if (index < classes.length - 1) {
        entry.label.appendChild(document.createTextNode(" "));
      }
    });
    entry.label.title = classes.join("\n");
    entry.classes = classes;
  }

  const VIEWPORT_PADDING = 4;

  function positionLabel(entry) {
    const rect = entry.el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    const label = entry.label;
    const wasVisible = label.classList.contains("visible");

    label.style.display = "block";
    label.style.visibility = "hidden";

    const labelWidth = label.offsetWidth;
    const labelHeight = label.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left;
    let top = rect.top - labelHeight - 2;

    if (top < VIEWPORT_PADDING) {
      top = rect.bottom + 2;
    }

    if (top + labelHeight > viewportHeight - VIEWPORT_PADDING) {
      top = rect.top - labelHeight - 2;
    }

    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    }

    if (left + labelWidth > viewportWidth - VIEWPORT_PADDING) {
      left = rect.right - labelWidth;
    }

    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, viewportWidth - labelWidth - VIEWPORT_PADDING)
    );

    label.style.left = `${left}px`;
    label.style.top = `${top}px`;
    label.style.visibility = "";
    if (!wasVisible) label.style.display = "";

    return true;
  }

  function showLabel(entry) {
    if (activeLabel && activeLabel !== entry) {
      activeLabel.label.classList.remove("visible");
    }

    activeLabel = entry;
    if (positionLabel(entry)) {
      entry.label.classList.add("visible");
    }
  }

  function hideLabel(entry) {
    entry.label.classList.remove("visible");
    if (activeLabel === entry) activeLabel = null;
  }

  function unregisterElement(el) {
    const entry = elementEntries.get(el);
    if (!entry) return;

    el.removeEventListener("mouseenter", entry.onEnter);
    el.removeEventListener("mouseleave", entry.onLeave);
    entry.label.remove();

    if (activeLabel === entry) activeLabel = null;

    elementEntries.delete(el);
    entries = entries.filter((item) => item !== entry);
  }

  function registerElement(el) {
    if (!(el instanceof Element)) return;

    const classes = getColorClasses(el);
    const existing = elementEntries.get(el);

    if (!classes.length) {
      if (existing) unregisterElement(el);
      return;
    }

    if (existing) {
      const current = existing.classes.join(" ");
      const next = classes.join(" ");
      if (current !== next) updateLabelContent(existing, classes);
      return;
    }

    const entry = { el, label: renderLabel(classes), classes };
    entry.onEnter = () => showLabel(entry);
    entry.onLeave = () => hideLabel(entry);

    el.addEventListener("mouseenter", entry.onEnter);
    el.addEventListener("mouseleave", entry.onLeave);
    elementEntries.set(el, entry);
    entries.push(entry);
  }

  function scanNode(node) {
    if (!(node instanceof Element)) return;

    registerElement(node);
    node.querySelectorAll("*").forEach(registerElement);
  }

  function unscanNode(node) {
    if (!(node instanceof Element)) return;

    unregisterElement(node);
    node.querySelectorAll("*").forEach(unregisterElement);
  }

  function startMutationObserver() {
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(scanNode);
          mutation.removedNodes.forEach(unscanNode);
        } else if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          registerElement(mutation.target);
        }
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function activateInspector() {
    if (inspectorActive) return { active: true, count: entries.length };

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${LABEL_CLASS} {
        position: fixed;
        z-index: 2147483647;
        pointer-events: none;
        display: none;
        font: 10px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 2px 6px;
        border-radius: 4px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        box-shadow: 0 2px 8px rgba(0,0,0,.35);
        white-space: nowrap;
        max-width: calc(100vw - ${VIEWPORT_PADDING * 2}px);
      }
      .${LABEL_CLASS}.visible { display: block; }
      .${LABEL_CLASS} .bg { color: #86efac; }
      .${LABEL_CLASS} .txt { color: #fde68a; }
    `;
    document.head.appendChild(style);

    scheduleUpdate = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (activeLabel) positionLabel(activeLabel);
      });
    };

    scanNode(document.documentElement);
    startMutationObserver();

    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    inspectorActive = true;

    return { active: true, count: entries.length };
  }

  function deactivateInspector() {
    if (!inspectorActive) return { active: false, count: 0 };

    mutationObserver?.disconnect();
    mutationObserver = null;

    [...entries].forEach(({ el }) => unregisterElement(el));

    document.getElementById(STYLE_ID)?.remove();
    window.removeEventListener("scroll", scheduleUpdate, true);
    window.removeEventListener("resize", scheduleUpdate);
    cancelAnimationFrame(raf);

    entries = [];
    elementEntries = new WeakMap();
    activeLabel = null;
    scheduleUpdate = null;
    inspectorActive = false;

    return { active: false, count: 0 };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "toggle") return;

    const result = inspectorActive
      ? deactivateInspector()
      : activateInspector();

    sendResponse(result);
  });
})();
