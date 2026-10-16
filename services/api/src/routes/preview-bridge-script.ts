/**
 * The selection bridge injected into every proxied preview HTML response.
 *
 * This is an embedded browser asset, not application code: one IIFE with a
 * single closure, shipped verbatim into the iframe. It lives in its own
 * module because nothing else in the route needs to read it — splitting the
 * closure further would mean concatenating string fragments and would make
 * the script harder to follow, not easier (0136 R12).
 *
 * What it does, in the page:
 *   - hit-tests the real DOM and reports the element under a point, with its
 *     React source location when one is available;
 *   - applies and resets live Design-mode style overrides;
 *   - walks the layer tree and reports changes back to the editor;
 *   - builds the export HTML and rasterizes the viewport for the 0127 Mark
 *     layer.
 *
 * Injected by `injectPreviewBridge` in ./preview-bridge.
 */
export const BRIDGE_SCRIPT = String.raw`
<script>
(() => {
  if (window.__SBER_DESIGNER_SELECTION_BRIDGE__) return;
  window.__SBER_DESIGNER_SELECTION_BRIDGE__ = true;
  let flowRuntimeEdges = [];
  let flowRuntimeParent = null;
  let flowRuntimeOrigin = "*";
  let flowRuntimePreferToScreenId = null;
  let flowRuntimeCloseOnEscape = false;
  let modalPreviewBaseline = null;
  let layerParent = null;
  let layerOrigin = "*";
  let layerObserver = null;
  let layerRaf = null;
  let inspectSequence = 1;
  const inspectOverrideStyles = new Map();
  const INSPECT_PREVIEW_STYLE_ATTR = "data-sber-designer-inspect-preview";
  const LIVE_INSPECT_STYLE_PROPERTIES = [
    "color",
    "backgroundColor",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "borderRadius",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
  ];
  const LIVE_INSPECT_STYLE_SET = new Set(LIVE_INSPECT_STYLE_PROPERTIES);

  function getFiber(node) {
    if (!node) return null;
    const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
    return key ? node[key] : null;
  }

  function findDebugSource(fiber) {
    let cur = fiber;
    let safety = 64;
    while (cur && safety-- > 0) {
      if (cur._debugSource) return cur._debugSource;
      if (cur._debugOwner && cur._debugOwner._debugSource) return cur._debugOwner._debugSource;
      cur = cur.return || null;
    }
    return null;
  }

  function parseLoc(raw) {
    const match = /^(.+):(\d+):(\d+)$/.exec(raw || "");
    if (!match) return null;
    return { file: match[1], line: Number(match[2]), column: Number(match[3]) };
  }

  function componentName(type) {
    if (!type) return null;
    if (typeof type === "function") return type.displayName || type.name || null;
    if (typeof type !== "object") return null;
    return (
      type.displayName ||
      type.name ||
      (type.render && (type.render.displayName || type.render.name)) ||
      (type.type && (type.type.displayName || type.type.name)) ||
      null
    );
  }

  function componentPathFor(element) {
    const path = [];
    let cur = getFiber(element);
    let safety = 64;
    while (cur && safety-- > 0 && path.length < 12) {
      const name = componentName(cur.type);
      if (name && path[path.length - 1] !== name) path.push(name);
      cur = cur.return || null;
    }
    return path;
  }

  function componentBoundaryFor(element) {
    const parent = (getFiber(element) || {}).return || null;
    const name = componentName(parent && parent.type);
    if (!name) return null;
    const src = findDebugSource(parent);
    return {
      name,
      loc: src
        ? {
            file: src.fileName,
            line: src.lineNumber,
            column: src.columnNumber || 0,
          }
        : null,
    };
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function selectedAttributes(element) {
    const names = [
      "data-sd-flow-id",
      "data-sd-label",
      "data-sd-nav-group",
      "data-testid",
      "id",
      "href",
      "aria-label",
      "role",
    ];
    const attrs = {};
    for (const name of names) {
      const value = element.getAttribute(name);
      if (name === "data-testid" && !isUsableTestId(value)) continue;
      if (value) attrs[name] = value;
    }
    return attrs;
  }

  function isUsableTestId(value) {
    value = String(value || "").trim();
    return Boolean(
      value &&
      !/^(?:undefined|null|nan)(?:[_-]|$)/i.test(value) &&
      !/\[object\s+object\]/i.test(value)
    );
  }

  function ensureInspectId(element) {
    const existing = element.getAttribute("data-sd-inspect-id");
    if (existing) return existing;
    const next = "sd-inspect-" + inspectSequence++;
    element.setAttribute("data-sd-inspect-id", next);
    return next;
  }

  function computedStyleSnapshot(element) {
    const style = window.getComputedStyle(element);
    const snapshot = {};
    LIVE_INSPECT_STYLE_PROPERTIES.forEach(function (property) {
      const value = style[property];
      if (value) snapshot[property] = value;
    });
    return snapshot;
  }

  function toCssPropertyName(property) {
    return String(property).replace(/[A-Z]/g, function (char) {
      return "-" + char.toLowerCase();
    });
  }

  function isSafeInspectValue(value) {
    value = String(value || "").trim();
    return (
      value &&
      value.length <= 160 &&
      !/<\/?style|<\/?script|[{};\n\r<>]/i.test(value)
    );
  }

  function normalizeInspectStyles(styles) {
    const result = {};
    if (!styles || typeof styles !== "object") return result;
    Object.keys(styles).forEach(function (property) {
      const value = styles[property];
      if (!LIVE_INSPECT_STYLE_SET.has(property)) return;
      if (typeof value !== "string" || !isSafeInspectValue(value)) return;
      result[property] = value.trim();
    });
    return result;
  }

  function inspectElementById(inspectId) {
    if (!inspectId) return null;
    try {
      return document.querySelector('[data-sd-inspect-id="' + escapeCssString(inspectId) + '"]');
    } catch (_err) {
      return null;
    }
  }

  function inspectPreviewStyleElement() {
    let element = document.querySelector("style[" + INSPECT_PREVIEW_STYLE_ATTR + "]");
    if (!element) {
      element = document.createElement("style");
      element.setAttribute(INSPECT_PREVIEW_STYLE_ATTR, "");
      (document.head || document.documentElement).appendChild(element);
    }
    return element;
  }

  function inspectOverrideRule(inspectId, styles) {
    const declarations = Object.keys(styles)
      .map(function (property) {
        return toCssPropertyName(property) + ": " + styles[property] + " !important";
      })
      .join("; ");
    if (!declarations) return "";
    return '[data-sd-inspect-id="' + escapeCssString(inspectId) + '"] { ' + declarations + " }";
  }

  function renderInspectOverrides() {
    const rules = [];
    inspectOverrideStyles.forEach(function (styles, inspectId) {
      const rule = inspectOverrideRule(inspectId, styles);
      if (rule) rules.push(rule);
    });
    inspectPreviewStyleElement().textContent = rules.join("\n");
  }

  function applyPreviewStyle(inspectId, styles) {
    const element = inspectElementById(inspectId);
    if (!(element instanceof HTMLElement)) return {};
    const patch = normalizeInspectStyles(styles);
    const next = Object.assign({}, inspectOverrideStyles.get(inspectId) || {}, patch);
    inspectOverrideStyles.set(inspectId, next);
    renderInspectOverrides();
    return patch;
  }

  function resetPreviewStyle(inspectId, properties) {
    const element = inspectElementById(inspectId);
    if (!(element instanceof HTMLElement)) return [];
    const current = inspectOverrideStyles.get(inspectId) || {};
    const keys = Array.isArray(properties) && properties.length ? properties : Object.keys(current);
    keys.forEach(function (property) {
      delete current[property];
    });
    if (Object.keys(current).length === 0) {
      inspectOverrideStyles.delete(inspectId);
    } else {
      inspectOverrideStyles.set(inspectId, current);
    }
    renderInspectOverrides();
    return keys;
  }

  function escapeCssString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function escapeCssIdent(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (char) {
      return "\\" + char;
    });
  }

  function preferredSelector(element, attrs) {
    const tag = element.tagName.toLowerCase();
    if (attrs["data-sd-flow-id"]) {
      return '[data-sd-flow-id="' + escapeCssString(attrs["data-sd-flow-id"]) + '"]';
    }
    if (attrs.id) return "#" + escapeCssIdent(attrs.id);
    if (attrs["data-testid"]) {
      return '[data-testid="' + escapeCssString(attrs["data-testid"]) + '"]';
    }
    if (attrs["aria-label"]) {
      return tag + '[aria-label="' + escapeCssString(attrs["aria-label"]) + '"]';
    }
    return null;
  }

  function describeElement(element) {
    const attrs = selectedAttributes(element);
    const text = normalizeText(element.innerText || element.textContent || "");
    const selector = preferredSelector(element, attrs);
    return {
      text: text || null,
      selector: selector || null,
      attributes: Object.keys(attrs).length > 0 ? attrs : null,
    };
  }

  function cssPath(element) {
    const parts = [];
    let cur = element;
    while (cur && cur !== document.body && parts.length < 6) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += "#" + cur.id;
        parts.unshift(part);
        break;
      }
      const className = Array.from(cur.classList || []).slice(0, 2).join(".");
      if (className) part += "." + className;
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((item) => item.tagName === cur.tagName);
        if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(cur) + 1) + ")";
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(" > ") || element.tagName.toLowerCase();
  }

  function sourceForElement(hit) {
    let cur = hit;
    while (cur && cur.nodeType === 1) {
      const fiber = getFiber(cur);
      const src = fiber ? findDebugSource(fiber) : null;
      if (src) {
        const boundary = componentBoundaryFor(cur);
        return {
          element: cur,
          sourceKind: "react-source",
          loc: {
            file: src.fileName,
            line: src.lineNumber,
            column: src.columnNumber || 0,
          },
          domPath: cssPath(cur),
          componentPath: componentPathFor(cur),
          componentName: boundary && boundary.name,
          componentLoc: boundary && boundary.loc,
        };
      }
      cur = cur.parentElement;
    }

    const tagged = hit.closest && hit.closest("[data-sd-loc]");
    const loc = tagged ? parseLoc(tagged.getAttribute("data-sd-loc")) : null;
    const element = loc ? tagged : hit;
    const boundary = componentBoundaryFor(element);
    return {
      element,
      sourceKind: loc ? "sd-loc" : "dom-fallback",
      loc: loc || { file: "dom://" + cssPath(hit), line: 0, column: 0 },
      domPath: cssPath(element),
      componentPath: componentPathFor(element),
      componentName: boundary && boundary.name,
      componentLoc: boundary && boundary.loc,
    };
  }

  function sourceAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    const source = sourceForElement(hit);
    if (source && source.element !== hit && source.sourceKind !== "dom-fallback") {
      source.selectionNotice =
        "Selected nearest source-backed ancestor " +
        source.element.tagName +
        " because the clicked " +
        hit.tagName +
        " has no direct source target.";
    }
    return source;
  }

  function formatLoc(loc) {
    if (!loc || !loc.file) return null;
    return loc.file + ":" + loc.line + ":" + (loc.column || 0);
  }

  function elementLoc(element) {
    const fiber = getFiber(element);
    const src = fiber ? findDebugSource(fiber) : null;
    if (src) {
      return {
        file: src.fileName,
        line: src.lineNumber,
        column: src.columnNumber || 0,
      };
    }
    const tagged = element.closest && element.closest("[data-sd-loc]");
    return tagged ? parseLoc(tagged.getAttribute("data-sd-loc")) : null;
  }

  function isVisibleTarget(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && style.pointerEvents !== "none";
  }

  function isFlowCandidate(element, details) {
    const tag = element.tagName.toLowerCase();
    const role = (element.getAttribute("role") || "").toLowerCase();
    if (details.selector) return true;
    if (["button", "a", "input", "select", "textarea", "summary"].includes(tag)) return true;
    if (["button", "link", "menuitem", "tab", "option"].includes(role)) return true;
    if (typeof element.onclick === "function") return true;
    return false;
  }

  function flowTargetId(element, index) {
    const details = describeElement(element);
    return details.selector || details.text || element.tagName.toLowerCase() + "-" + index;
  }

  function collectFlowTargets(query) {
    const needle = normalizeText(query || "").toLowerCase();
    const seen = new Set();
    const result = [];
    const elements = Array.from(
      document.querySelectorAll(
        "button,a[href],input,select,textarea,summary,[role],[data-sd-flow-id],[data-testid],[aria-label]"
      )
    );

    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue;
      if (!isVisibleTarget(element)) continue;
      const details = describeElement(element);
      if (!isFlowCandidate(element, details)) continue;
      const boundary = componentBoundaryFor(element);
      const loc = elementLoc(element);
      const haystack = [
        element.tagName,
        details.text,
        details.selector,
        boundary && boundary.name,
        details.attributes && Object.entries(details.attributes).flat().join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      const id = flowTargetId(element, result.length);
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({
        id,
        tagName: element.tagName,
        text: details.text,
        selector: details.selector,
        componentName: boundary && boundary.name,
        componentLoc: formatLoc((boundary && boundary.loc) || loc),
        attributes: details.attributes,
      });
      if (result.length >= 40) break;
    }
    return result;
  }

  function stableLayerId(source, details, element, rect) {
    const loc = formatLoc(source.loc);
    if (loc && source.sourceKind !== "dom-fallback") return "source:" + source.sourceKind + ":" + loc;
    if (details.attributes && details.attributes["data-sd-flow-id"]) {
      return "flow:" + details.attributes["data-sd-flow-id"];
    }
    if (details.selector) return "selector:" + details.selector;
    if (source.domPath) return "dom:" + source.domPath;
    return "element:" + element.tagName.toLowerCase() + ":" + Math.round(rect.left) + ":" + Math.round(rect.top);
  }

  function shouldSkipLayerElement(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "link" || tag === "meta") return true;
    const rect = element.getBoundingClientRect();
    return rect.width <= 0 || rect.height <= 0;
  }

  function collectLayerTree() {
    const root = document.querySelector("#storybook-root") || document.querySelector("#root") || document.body;
    if (!root) return null;
    let count = 0;
    function visit(element, depth) {
      if (!(element instanceof HTMLElement)) return null;
      if (count >= 500 || depth > 10 || shouldSkipLayerElement(element)) return null;
      count += 1;
      const source = sourceForElement(element);
      const rect = element.getBoundingClientRect();
      const details = describeElement(element);
      const children =
        depth >= 10
          ? []
          : Array.from(element.children)
              .map(function (child) {
                return visit(child, depth + 1);
              })
              .filter(Boolean);
      return {
        id: stableLayerId(source, details, element, rect),
        tagName: element.tagName,
        loc: formatLoc(source.loc),
        sourceKind: source.sourceKind,
        domPath: source.domPath,
        componentPath: source.componentPath,
        componentName: source.componentName || null,
        componentLoc: formatLoc(source.componentLoc),
        selector: details.selector || source.domPath || null,
        text: details.text,
        attributes: details.attributes,
        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        children,
      };
    }
    return visit(root, 0);
  }

  function postLayerTree(type, requestId) {
    if (!layerParent) return;
    const payload = { type, tree: collectLayerTree() };
    if (requestId !== undefined) payload.requestId = requestId;
    layerParent.postMessage(payload, layerOrigin || "*");
  }

  function scheduleLayerChanged() {
    if (!layerParent || layerRaf !== null) return;
    layerRaf = window.requestAnimationFrame(function () {
      layerRaf = null;
      postLayerTree("sber-designer:layers-changed");
    });
  }

  function startLayerObserver() {
    if (layerObserver || typeof MutationObserver === "undefined") return;
    const target = document.body || document.documentElement;
    if (!target) return;
    layerObserver = new MutationObserver(scheduleLayerChanged);
    layerObserver.observe(target, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function keepExportUrl(value) {
    return (
      !value ||
      value.indexOf("#") === 0 ||
      value.indexOf("data:") === 0 ||
      value.indexOf("blob:") === 0 ||
      value.indexOf("javascript:") === 0 ||
      value.indexOf("mailto:") === 0 ||
      value.indexOf("tel:") === 0
    );
  }

  function absolutizeExportUrls(root) {
    const attrs = ["href", "src", "poster"];
    Array.from(root.querySelectorAll("*")).forEach(function (element) {
      attrs.forEach(function (attr) {
        const value = element.getAttribute(attr);
        if (keepExportUrl(value)) return;
        try {
          element.setAttribute(attr, new URL(value, window.location.href).toString());
        } catch (_err) {
          // Keep malformed URLs unchanged.
        }
      });
      const srcset = element.getAttribute("srcset");
      if (!srcset) return;
      element.setAttribute(
        "srcset",
        srcset
          .split(",")
          .map(function (part) {
            const trimmed = part.trim();
            if (!trimmed) return trimmed;
            const pieces = trimmed.split(/\s+/);
            const url = pieces.shift();
            if (!url || keepExportUrl(url)) return trimmed;
            try {
              return [new URL(url, window.location.href).toString()].concat(pieces).join(" ");
            } catch (_err) {
              return trimmed;
            }
          })
          .join(", ")
      );
    });
  }

  function buildExportHtml() {
    const root = document.documentElement.cloneNode(true);
    Array.from(root.querySelectorAll("script")).forEach(function (node) {
      node.remove();
    });
    Array.from(root.querySelectorAll("[data-sber-designer-overlay]")).forEach(function (node) {
      node.remove();
    });
    absolutizeExportUrls(root);

    const head = root.querySelector("head") || root.insertBefore(document.createElement("head"), root.firstChild);
    const source = document.createElement("meta");
    source.setAttribute("name", "sber-designer:source");
    source.setAttribute("content", window.location.href);
    head.prepend(source);

    const generator = document.createElement("meta");
    generator.setAttribute("name", "generator");
    generator.setAttribute("content", "sber-designer html export");
    head.prepend(generator);

    return "<!doctype html>\n" + root.outerHTML + "\n";
  }

  // ---- Mark-layer snapshot bridge (0127) -----------------------------------
  // Rasterizes the CURRENT viewport of this document via SVG <foreignObject>
  // so the editor's Mark layer can composite red-marker annotations onto a
  // real screenshot. External stylesheets never load inside an SVG image, so
  // computed styles are inlined per element first (same technique as the
  // hit-test bridge's sibling in Open Design). Best-effort: external raster
  // images may be missing; a fully blank paint reports an error instead of
  // shipping an empty frame.
  var SNAPSHOT_STYLE_PROPS = [
    "display", "position", "box-sizing", "width", "height", "min-width", "max-width",
    "min-height", "max-height",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border", "border-top", "border-right", "border-bottom", "border-left", "border-radius",
    "font", "font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "color", "background-color", "background-image", "background-size",
    "background-position", "background-repeat", "opacity", "transform", "transform-origin",
    "overflow", "overflow-x", "overflow-y", "white-space", "text-align", "vertical-align",
    "text-decoration", "text-transform", "object-fit", "object-position", "cursor",
    "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
    "grid", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
    "gap", "row-gap", "column-gap", "align-items", "align-content", "align-self",
    "justify-items", "justify-content", "justify-self", "inset", "top", "right",
    "bottom", "left", "z-index", "box-shadow", "text-shadow", "fill", "stroke",
  ];
  function snapshotCopyComputedStyle(source, target) {
    if (!source || !target || source.nodeType !== 1 || target.nodeType !== 1) return;
    var computed = window.getComputedStyle(source);
    var style = target.getAttribute("style") || "";
    for (var i = 0; i < SNAPSHOT_STYLE_PROPS.length; i++) {
      var prop = SNAPSHOT_STYLE_PROPS[i];
      var value = computed.getPropertyValue(prop);
      if (value) style += prop + ":" + value + ";";
    }
    target.setAttribute("style", style);
  }
  function snapshotSyncElementState(source, target) {
    var tag = source.tagName ? source.tagName.toLowerCase() : "";
    if (tag === "img" && source.currentSrc) target.setAttribute("src", source.currentSrc);
    if (tag === "input" || tag === "textarea") target.setAttribute("value", source.value || "");
    if (tag === "canvas") {
      try {
        var img = document.createElement("img");
        img.setAttribute("src", source.toDataURL("image/png"));
        img.setAttribute("style", target.getAttribute("style") || "");
        if (target.parentNode) target.parentNode.replaceChild(img, target);
      } catch (_err) {}
    }
  }
  function snapshotInlineStyles(originalRoot, cloneRoot) {
    snapshotCopyComputedStyle(originalRoot, cloneRoot);
    snapshotSyncElementState(originalRoot, cloneRoot);
    var originals = originalRoot.querySelectorAll("*");
    var clones = cloneRoot.querySelectorAll("*");
    var count = Math.min(originals.length, clones.length, 4000);
    for (var i = 0; i < count; i++) {
      snapshotCopyComputedStyle(originals[i], clones[i]);
      snapshotSyncElementState(originals[i], clones[i]);
    }
    var scripts = cloneRoot.querySelectorAll("script");
    for (var s = scripts.length - 1; s >= 0; s--) scripts[s].remove();
    var links = cloneRoot.querySelectorAll('link[rel~="stylesheet"], link[rel~="preload"], link[rel~="preconnect"]');
    for (var l = links.length - 1; l >= 0; l--) links[l].remove();
    var styles = cloneRoot.querySelectorAll("style");
    for (var st = 0; st < styles.length; st++) {
      styles[st].textContent = (styles[st].textContent || "")
        .replace(/@import[^;]+;/gi, "")
        .replace(/@font-face\s*\{[^}]*\}/gi, "");
    }
  }
  function snapshotPruneHidden(originalRoot, cloneRoot) {
    var originals = originalRoot.querySelectorAll("*");
    var clones = cloneRoot.querySelectorAll("*");
    var count = Math.min(originals.length, clones.length);
    var removals = [];
    for (var i = 0; i < count; i++) {
      var original = originals[i];
      var clone = clones[i];
      if (!original || !clone || !clone.parentNode) continue;
      var computed = window.getComputedStyle(original);
      if (computed && (computed.display === "none" || computed.visibility === "hidden")) {
        removals.push(clone);
      }
    }
    for (var r = removals.length - 1; r >= 0; r--) {
      if (removals[r].parentNode) removals[r].parentNode.removeChild(removals[r]);
    }
  }
  function snapshotWaitForImages() {
    var imgs = Array.prototype.slice.call(document.images || []);
    return Promise.all(
      imgs.map(function (img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      })
    );
  }
  function snapshotScrollOffset() {
    var doc = document.documentElement;
    var body = document.body;
    return {
      x: Math.max(window.scrollX || 0, doc ? doc.scrollLeft || 0 : 0, body ? body.scrollLeft || 0 : 0),
      y: Math.max(window.scrollY || 0, doc ? doc.scrollTop || 0 : 0, body ? body.scrollTop || 0 : 0),
    };
  }
  function snapshotEscapeAttribute(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function snapshotBackgroundColor() {
    try {
      var probe = window.getComputedStyle(document.body || document.documentElement);
      var bg = (probe && probe.backgroundColor) || "";
      if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return "#ffffff";
      return bg;
    } catch (_err) {
      return "#ffffff";
    }
  }
  // A uniform bitmap means foreignObject painted nothing; report an honest
  // error instead of returning a background-only frame.
  function snapshotLooksBlank(ctx, cw, ch) {
    try {
      var data = ctx.getImageData(0, 0, cw, ch).data;
      var step = Math.max(4, Math.floor((cw * ch) / 4096)) * 4;
      var first = null;
      var samples = 0;
      for (var i = 0; i + 3 < data.length; i += step) {
        samples++;
        if (!first) {
          first = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          continue;
        }
        if (
          Math.abs(data[i] - first[0]) > 6 ||
          Math.abs(data[i + 1] - first[1]) > 6 ||
          Math.abs(data[i + 2] - first[2]) > 6 ||
          Math.abs(data[i + 3] - first[3]) > 6
        ) {
          return false;
        }
      }
      return samples > 8;
    } catch (_err) {
      return false;
    }
  }
  // Primary rasterizer: html-to-image (inlined by the proxy as
  // <script data-sd-rasterizer>). Renders the whole document, then crops the
  // current scroll viewport so the shot matches what the user sees. The
  // hand-rolled foreignObject path below stays as a fallback only — it
  // blank-renders on real stylesheet-driven pages.
  function captureViaHtmlToImage() {
    var api = window.htmlToImage;
    if (!api || typeof api.toCanvas !== "function") {
      return Promise.reject(new Error("html-to-image unavailable"));
    }
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var docW = Math.max(w, document.documentElement.scrollWidth || 0, document.body ? document.body.scrollWidth : 0);
    var docH = Math.max(h, document.documentElement.scrollHeight || 0, document.body ? document.body.scrollHeight : 0);
    // Very tall pages at dpr 2 would allocate huge intermediate canvases;
    // drop to 1x before that becomes a memory problem.
    var pixelRatio = docW * docH > 4000000 ? 1 : dpr;
    var scroll = snapshotScrollOffset();
    var bgColor = snapshotBackgroundColor();
    return api
      .toCanvas(document.documentElement, {
        pixelRatio: pixelRatio,
        backgroundColor: bgColor,
        filter: function (node) {
          return !node.tagName || node.tagName.toLowerCase() !== "script";
        },
      })
      .then(function (full) {
        var out = document.createElement("canvas");
        out.width = Math.max(1, Math.floor(w * pixelRatio));
        out.height = Math.max(1, Math.floor(h * pixelRatio));
        var ctx = out.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(
          full,
          Math.floor(scroll.x * pixelRatio),
          Math.floor(scroll.y * pixelRatio),
          out.width,
          out.height,
          0,
          0,
          out.width,
          out.height
        );
        if (snapshotLooksBlank(ctx, out.width, out.height)) {
          throw new Error("empty-render");
        }
        return { dataUrl: out.toDataURL("image/png"), w: out.width, h: out.height };
      });
  }
  // A hung rasterizer must never leave the requester without an answer: race
  // the library path against a hard timeout, then fall back to foreignObject
  // (html-to-image 1.11.12+ can hang in stylesheet embedding — we pin 1.11.11,
  // but the race keeps the bridge honest even if the dependency drifts).
  function captureViewportSnapshot() {
    var timeoutError = new Error("html-to-image timeout");
    var timer = null;
    var timeout = new Promise(function (_resolve, reject) {
      timer = window.setTimeout(function () {
        reject(timeoutError);
      }, 6000);
    });
    return Promise.race([captureViaHtmlToImage(), timeout])
      .then(
        function (res) {
          if (timer !== null) window.clearTimeout(timer);
          return res;
        },
        function (err) {
          if (timer !== null) window.clearTimeout(timer);
          throw err;
        }
      )
      .catch(function () {
        return captureViaForeignObject();
      });
  }
  function captureViaForeignObject() {
    return new Promise(function (resolve, reject) {
      var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var bgColor = snapshotBackgroundColor();
      var docW = Math.max(w, document.documentElement.scrollWidth || 0, document.body ? document.body.scrollWidth : 0);
      var docH = Math.max(h, document.documentElement.scrollHeight || 0, document.body ? document.body.scrollHeight : 0);
      var clone = document.documentElement.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      snapshotInlineStyles(document.documentElement, clone);
      snapshotPruneHidden(document.documentElement, clone);
      var scroll = snapshotScrollOffset();
      var cloneBody = clone.querySelector("body");
      var rootStyle = clone.getAttribute("style") || "";
      var bodyStyle = cloneBody ? cloneBody.getAttribute("style") || "" : "";
      var bodyContent = cloneBody ? cloneBody.innerHTML : clone.innerHTML;
      var wrapperStyle =
        rootStyle + bodyStyle +
        "margin:0;position:relative;left:" + -scroll.x + "px;top:" + -scroll.y + "px;" +
        "width:" + docW + "px;height:" + docH + "px;overflow:visible;";
      var html =
        '<div xmlns="http://www.w3.org/1999/xhtml" style="' + snapshotEscapeAttribute(wrapperStyle) + '">' +
        bodyContent +
        "</div>";
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + " " + h + '">' +
        '<foreignObject x="0" y="0" width="' + docW + '" height="' + docH + '">' +
        html +
        "</foreignObject></svg>";
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(w * dpr));
          canvas.height = Math.max(1, Math.floor(h * dpr));
          var ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no 2d context");
          ctx.scale(dpr, dpr);
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          if (snapshotLooksBlank(ctx, canvas.width, canvas.height)) {
            reject(new Error("empty-render"));
            return;
          }
          resolve({ dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String((err && err.message) || err)));
        }
      };
      img.onerror = function () {
        reject(new Error("snapshot image failed"));
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  // --------------------------------------------------------------------------

  function hrefMatches(actual, expected) {
    actual = normalizeRuntimeHref(actual);
    expected = normalizeRuntimeHref(expected);
    if (!actual || !expected) return false;
    if (actual === expected) return true;
    if (actual.endsWith("/" + expected) || expected.endsWith("/" + actual)) return true;
    if (isHtmlRuntimeHref(actual) && isHtmlRuntimeHref(expected)) {
      return hrefBasename(actual) === hrefBasename(expected);
    }
    return false;
  }

  function normalizeRuntimeHref(value) {
    var href = String(value || "").trim();
    if (!href) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      try {
        href = new URL(href, window.location.href).pathname;
      } catch (_err) {}
    }
    href = (href.split("#")[0] || "").split("?")[0] || "";
    return href.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/^(?:\.\.\/)+/, "").trim();
  }

  function isHtmlRuntimeHref(value) {
    return /\.html?$/i.test(value);
  }

  function hrefBasename(value) {
    var parts = String(value || "").split("/").filter(Boolean);
    return parts[parts.length - 1] || value;
  }

  function runtimeClickText(element) {
    return normalizeText((element && (element.innerText || element.textContent)) || "");
  }

  function modalContractSnapshot() {
    var nodes = document.querySelectorAll("[data-sd-modal-window]");
    if (nodes.length === 0) return { status: "unmanaged" };
    if (nodes.length > 1) return { status: "ambiguous" };
    var element = nodes[0];
    var rect = element.getBoundingClientRect();
    return {
      status: "ok",
      values: {
        width: element.style.getPropertyValue("--sd-modal-width").trim(),
        height: element.style.getPropertyValue("--sd-modal-height").trim(),
        longContent: element.getAttribute("data-sd-modal-content") === "grow" ? "grow" : "scroll",
      },
      rect: { width: rect.width, height: rect.height },
    };
  }

  function applyModalContractValues(values) {
    var nodes = document.querySelectorAll("[data-sd-modal-window]");
    if (nodes.length !== 1 || !values) return;
    var element = nodes[0];
    element.style["setProperty"]("--sd-modal-width", String(values.width || ""));
    element.style["setProperty"]("--sd-modal-height", String(values.height || ""));
    element.setAttribute(
      "data-sd-modal-content",
      values.longContent === "grow" ? "grow" : "scroll"
    );
  }

  function setStandaloneModalPreview(enabled) {
    var styleId = "sber-designer-standalone-modal-preview";
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();
    if (!enabled) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent =
      "html,body{width:100%!important;height:100%!important;margin:0!important;overflow:hidden!important;background:transparent!important}" +
      "[data-sd-modal-backdrop]{position:relative!important;inset:auto!important;width:100%!important;height:100%!important;min-height:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}" +
      "[data-sd-modal-window]{width:100%!important;max-width:none!important}" +
      "[data-sd-modal-window][data-sd-modal-content=scroll]{height:100%!important;max-height:none!important}" +
      "[data-sd-modal-window][data-sd-modal-content=grow]{max-height:none!important}";
    document.head.appendChild(style);
  }

  function postModalContractResult(event, requestId) {
    var snapshot = modalContractSnapshot();
    event.source && event.source.postMessage(
      {
        type: "sber-designer:modal-contract-result",
        requestId: requestId,
        status: snapshot.status,
        values: snapshot.values,
        rect: snapshot.rect,
      },
      event.origin || "*"
    );
  }

  function clickEdgeMatches(edge, target) {
    if (!edge || !edge.trigger || edge.trigger.kind !== "click") return false;
    if (edge.trigger.selector) {
      try {
        if (target.closest && target.closest(edge.trigger.selector)) return true;
      } catch (_err) {
        return false;
      }
    }
    if (edge.trigger.label) {
      return normalizeText(edge.trigger.label) === runtimeClickText(target);
    }
    return false;
  }

  function edgeForRuntimeClick(target) {
    const anchor = target.closest && target.closest("a[href]");
    if (anchor) {
      const href = anchor.getAttribute("href") || "";
      const linkMatches = flowRuntimeEdges.filter(function (edge) {
        return edge && edge.trigger && edge.trigger.kind === "link" && hrefMatches(href, edge.trigger.href);
      });
      const linkEdge =
        linkMatches.find(function (edge) { return edge.toScreenId === flowRuntimePreferToScreenId; }) ||
        linkMatches[0];
      if (linkEdge) return linkEdge;
    }
    const clickMatches = flowRuntimeEdges.filter(function (edge) {
      return clickEdgeMatches(edge, target);
    });
    return (
      clickMatches.find(function (edge) { return edge.toScreenId === flowRuntimePreferToScreenId; }) ||
      clickMatches[0]
    );
  }

  function activateRuntimeEdge(edge) {
    if (!flowRuntimeParent || !edge || !edge.id) return;
    flowRuntimeParent.postMessage(
      { type: "sber-designer:flow-edge-activated", edgeId: edge.id },
      flowRuntimeOrigin || "*"
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      if (!flowRuntimeEdges.length) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const edge = edgeForRuntimeClick(target);
      if (!edge) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      activateRuntimeEdge(edge);
    },
    true
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (!flowRuntimeCloseOnEscape || event.key !== "Escape" || !flowRuntimeParent) return;
      event.preventDefault();
      event.stopPropagation();
      flowRuntimeParent.postMessage(
        { type: "sber-designer:flow-runtime-escape" },
        flowRuntimeOrigin || "*"
      );
    },
    true
  );

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === "sber-designer:modal-contract") {
      if (data.action === "preview") {
        if (!modalPreviewBaseline) {
          var baseline = modalContractSnapshot();
          modalPreviewBaseline = baseline.status === "ok" ? baseline.values : null;
        }
        applyModalContractValues(data.values);
      } else if (data.action === "reset") {
        if (modalPreviewBaseline) applyModalContractValues(modalPreviewBaseline);
        modalPreviewBaseline = null;
      } else if (data.action === "standalone") {
        setStandaloneModalPreview(data.enabled === true);
      }
      postModalContractResult(event, data.requestId);
      return;
    }
    if (data.type === "sber-designer:flow-runtime-config") {
      flowRuntimeParent = event.source || null;
      flowRuntimeOrigin = event.origin || "*";
      flowRuntimeEdges = Array.isArray(data.edges) ? data.edges : [];
      flowRuntimePreferToScreenId =
        typeof data.preferToScreenId === "string" ? data.preferToScreenId : null;
      flowRuntimeCloseOnEscape = data.closeOnEscape === true;
      if (data.focusModal === true) {
        window.requestAnimationFrame(function () {
          var focusable = document.querySelector(
            "[data-sd-modal-window] button, [data-sd-modal-window] [href], [data-sd-modal-window] input, [data-sd-modal-window] select, [data-sd-modal-window] textarea, [data-sd-modal-window] [tabindex]:not([tabindex='-1'])"
          );
          if (focusable && typeof focusable.focus === "function") {
            focusable.focus({ preventScroll: true });
          }
        });
      }
      return;
    }
    if (data.type === "sber-designer:list-flow-targets") {
      event.source && event.source.postMessage(
        {
          type: "sber-designer:flow-targets-result",
          requestId: data.requestId,
          targets: collectFlowTargets(data.query || ""),
        },
        event.origin || "*"
      );
      return;
    }
    if (data.type === "sber-designer:export-html") {
      try {
        event.source && event.source.postMessage(
          {
            type: "sber-designer:export-html-result",
            requestId: data.requestId,
            html: buildExportHtml(),
          },
          event.origin || "*"
        );
      } catch (err) {
        event.source && event.source.postMessage(
          {
            type: "sber-designer:export-html-result",
            requestId: data.requestId,
            error: err && err.message ? err.message : String(err),
          },
          event.origin || "*"
        );
      }
      return;
    }
    if (data.type === "sber-designer:snapshot") {
      var snapshotSource = event.source;
      var snapshotOrigin = event.origin || "*";
      var snapshotRequestId = data.requestId;
      snapshotWaitForImages()
        .then(function () {
          return captureViewportSnapshot();
        })
        .then(
          function (res) {
            snapshotSource && snapshotSource.postMessage(
              {
                type: "sber-designer:snapshot-result",
                requestId: snapshotRequestId,
                dataUrl: res.dataUrl,
                w: res.w,
                h: res.h,
              },
              snapshotOrigin
            );
          },
          function (err) {
            snapshotSource && snapshotSource.postMessage(
              {
                type: "sber-designer:snapshot-result",
                requestId: snapshotRequestId,
                error: String((err && err.message) || err),
              },
              snapshotOrigin
            );
          }
        );
      return;
    }
    if (data.type === "sber-designer:scroll-by") {
      window.scrollBy({ left: Number(data.left) || 0, top: Number(data.top) || 0, behavior: "auto" });
      return;
    }
    if (data.type === "sber-designer:list-layers") {
      layerParent = event.source || null;
      layerOrigin = event.origin || "*";
      startLayerObserver();
      postLayerTree("sber-designer:layers-result", data.requestId);
      return;
    }
    if (data.type === "sber-designer:preview-style") {
      const appliedStyles = applyPreviewStyle(data.inspectId, data.styles || {});
      event.source && event.source.postMessage(
        {
          type: "sber-designer:preview-style-applied",
          requestId: data.requestId,
          inspectId: data.inspectId,
          styles: appliedStyles,
        },
        event.origin || "*"
      );
      return;
    }
    if (data.type === "sber-designer:reset-preview-style") {
      const properties = resetPreviewStyle(data.inspectId, data.properties);
      event.source && event.source.postMessage(
        {
          type: "sber-designer:preview-style-reset",
          requestId: data.requestId,
          inspectId: data.inspectId,
          properties,
        },
        event.origin || "*"
      );
      return;
    }
    if (data.type !== "sber-designer:hit-test") return;
    const hit = sourceAt(data.x, data.y);
    if (!hit) {
      event.source && event.source.postMessage(
        { type: "sber-designer:hit-test-result", requestId: data.requestId, hit: null },
        event.origin || "*"
      );
      return;
    }
    const rect = hit.element.getBoundingClientRect();
    const details = describeElement(hit.element);
    const inspectId = ensureInspectId(hit.element);
    event.source && event.source.postMessage(
      {
        type: "sber-designer:hit-test-result",
        requestId: data.requestId,
        hit: {
          tagName: hit.element.tagName,
          loc: hit.loc,
          sourceKind: hit.sourceKind,
          domPath: hit.domPath,
          componentPath: hit.componentPath,
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          text: details.text,
          selector: details.selector,
          componentName: hit.componentName || null,
          componentLoc: hit.componentLoc || null,
          attributes: details.attributes,
          selectionNotice: hit.selectionNotice || null,
          inspectId,
          computedStyles: computedStyleSnapshot(hit.element),
        },
      },
      event.origin || "*"
    );
  });
})();
</script>`;
