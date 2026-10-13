(() => {
  if (window.__chapterCollectorScannerLoaded) return;
  window.__chapterCollectorScannerLoaded = true;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function reportProgress(detail) {
    chrome.runtime.sendMessage({ type: "GOOGLE_SCAN_PROGRESS", ...detail }).catch(() => {});
  }

  function cleanUrl(raw) {
    if (!raw || typeof raw !== "string") return null;
    let value = raw
      .replaceAll("\\u003d", "=")
      .replaceAll("\\u0026", "&")
      .replaceAll("\\/", "/")
      .replaceAll("&amp;", "&")
      .trim();

    try {
      value = decodeURIComponent(value);
    } catch (_) {
      // It was already decoded or contains an incomplete escape.
    }

    try {
      const url = new URL(value, location.href);
      if (!/^https?:$/.test(url.protocol)) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function isUsefulUrl(url) {
    if (!url || url.length > 5000) return false;
    if (/google\.(com|usercontent\.com)\/images\/branding/i.test(url)) return false;
    if (/gstatic\.com\/images\/icons/i.test(url)) return false;
    if (/^https?:\/\/(?:ssl|www)\.gstatic\.com\//i.test(url)) return false;
    if (/\/favicon(?:\.ico)?(?:\?|$)/i.test(url)) return false;
    if (/^https?:\/\/www\.google\.com\/(?:search|imgres)/i.test(url)) return false;
    return true;
  }

  function largestSrcsetUrl(srcset) {
    if (!srcset) return null;
    const entries = srcset.split(",").map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const score = Number.parseFloat(parts[1]) || 1;
      return { url: parts[0], score };
    });
    entries.sort((a, b) => b.score - a.score);
    return entries[0]?.url || null;
  }

  function collectCandidates() {
    const found = new Map();
    let position = 0;

    const add = (raw, source, width = 0, height = 0) => {
      const url = cleanUrl(raw);
      if (!isUsefulUrl(url) || found.has(url)) return;
      if (source === "rendered-image" && (Number(width) < 96 || Number(height) < 64)) return;
      found.set(url, {
        url,
        source,
        position: position++,
        observedWidth: Number(width) || 0,
        observedHeight: Number(height) || 0
      });
    };

    for (const anchor of document.querySelectorAll("a[href]")) {
      try {
        const href = new URL(anchor.href, location.href);
        add(href.searchParams.get("imgurl"), "imgurl");
        add(href.searchParams.get("mediaurl"), "mediaurl");
      } catch (_) {}
    }

    for (const image of document.images) {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const attributes = [
        image.getAttribute("data-iurl"),
        image.getAttribute("data-ou"),
        image.getAttribute("data-original"),
        image.getAttribute("data-src"),
        largestSrcsetUrl(image.getAttribute("srcset")),
        image.currentSrc,
        image.src
      ];
      attributes.forEach((url, index) => add(url, index < 5 ? "original-attribute" : "rendered-image", width, height));

      const link = image.closest("a[href]");
      if (link) {
        try {
          const href = new URL(link.href, location.href);
          add(href.searchParams.get("imgurl"), "linked-original", width, height);
        } catch (_) {}
      }
    }

    for (const element of document.querySelectorAll("[data-iurl],[data-ou],[data-src],[data-original]")) {
      ["data-iurl", "data-ou", "data-src", "data-original"].forEach((name) => add(element.getAttribute(name), "data-attribute"));
    }

    const html = document.documentElement.innerHTML;
    const patterns = [
      /"(?:ou|imgurl|imageUrl|original)"\s*:\s*"(https?:[^"\\]*(?:\\.[^"\\]*)*)"/gi,
      /\["(https?:\\?\/\\?\/[^"\]]+?\.(?:jpe?g|png|webp|gif|avif|svg)(?:\?[^"\]]*)?)"/gi
    ];
    for (const pattern of patterns) {
      let match;
      let safety = 0;
      while ((match = pattern.exec(html)) && safety++ < 1500) add(match[1], "page-data");
    }

    return [...found.values()].sort((a, b) => candidateScore(b) - candidateScore(a) || a.position - b.position);
  }

  function candidateScore(candidate) {
    const sourceScore = {
      imgurl: 120,
      mediaurl: 120,
      "linked-original": 115,
      "original-attribute": 105,
      "page-data": 100,
      "data-attribute": 90,
      "rendered-image": 20
    }[candidate.source] || 0;
    const pixels = candidate.observedWidth * candidate.observedHeight;
    return sourceScore + Math.min(20, Math.log10(Math.max(1, pixels)) * 3);
  }

  function pageNeedsHuman() {
    const blockedPath = /\/sorry(?:\/|$)/i.test(location.pathname);
    const captchaControl = document.querySelector([
      "form#captcha-form",
      "iframe[src*='recaptcha']",
      ".g-recaptcha",
      "#recaptcha",
      "input[name='captcha']",
      "[data-sitekey]"
    ].join(","));
    const text = `${document.title} ${document.body?.innerText?.slice(0, 3500) || ""}`;
    const explicitBlockMessage = /our systems have detected unusual traffic|automated queries|tráfico inusual|consultas automatizadas/i.test(text);
    const visibleResultImages = [...document.images].filter((image) => (image.naturalWidth || image.width) >= 96 && (image.naturalHeight || image.height) >= 64);
    const hasImageResults = Boolean(document.querySelector("a[href*='imgurl'], [data-iurl], [data-ou]")) || visibleResultImages.length >= 3;
    return blockedPath || Boolean(captchaControl) || (explicitBlockMessage && !hasImageResults);
  }

  async function revealPreviewImages(limit, onCollected) {
    const thumbnails = [...document.images]
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width >= 100 && rect.height >= 70 && img.closest("a, div[role='button']");
      })
      .slice(0, Math.min(limit, 36));

    for (let index = 0; index < thumbnails.length; index++) {
      const image = thumbnails[index];
      if (pageNeedsHuman()) break;
      image.scrollIntoView({ block: "center" });
      image.click();
      await wait(360);
      onCollected(collectCandidates());
      reportProgress({ phase: "preview", current: index + 1, total: thumbnails.length });
    }
  }

  async function scanGoogleImages(candidateGoal) {
    reportProgress({ phase: "start", found: 0, current: 0, total: candidateGoal });
    if (pageNeedsHuman()) return { captcha: true, candidates: [] };

    const cumulative = new Map();
    const merge = (items) => {
      for (const candidate of items) {
        const existing = cumulative.get(candidate.url);
        if (!existing || candidateScore(candidate) > candidateScore(existing)) cumulative.set(candidate.url, candidate);
      }
    };
    const sorted = () => [...cumulative.values()].sort((a, b) => candidateScore(b) - candidateScore(a) || a.position - b.position);

    merge(collectCandidates());
    let candidates = sorted();
    reportProgress({ phase: "discover", found: candidates.length, current: 1, total: 32 });
    let unchanged = 0;
    const maxRounds = 32;
    const minimumRounds = candidateGoal <= 10 ? 1 : 4;

    for (let round = 0; round < maxRounds && (round < minimumRounds || candidates.length < candidateGoal); round++) {
      const previous = candidates.length;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      await wait(650);

      const moreButton = [...document.querySelectorAll("button, input[type='button'], a")]
        .find((el) => /show more|more results|mostrar más|más resultados/i.test(el.textContent || el.value || ""));
      if (moreButton && round > 3) moreButton.click();

      merge(collectCandidates());
      candidates = sorted();
      reportProgress({ phase: "discover", found: candidates.length, current: round + 2, total: 32 });
      unchanged = candidates.length === previous ? unchanged + 1 : 0;
      if (unchanged >= 4) break;
      if (pageNeedsHuman()) return { captcha: true, candidates };
    }

    const originalCount = candidates.filter((candidate) => candidateScore(candidate) >= 90).length;
    if (originalCount < candidateGoal) {
      await revealPreviewImages(candidateGoal - originalCount, merge);
      candidates = sorted();
    }

    reportProgress({ phase: "done", found: candidates.length, current: candidateGoal, total: candidateGoal });
    return { captcha: pageNeedsHuman(), candidates: candidates.slice(0, Math.max(candidateGoal, 10)) };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CHECK_GOOGLE_CAPTCHA") {
      sendResponse({
        captcha: pageNeedsHuman(),
        ready: document.readyState === "complete" && Boolean(document.body)
      });
      return false;
    }

    if (message?.type !== "COLLECT_GOOGLE_IMAGES") return undefined;

    scanGoogleImages(Math.max(10, Number(message.candidateGoal) || 30))
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message, candidates: [] }));
    return true;
  });
})();
