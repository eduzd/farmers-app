"""Looks at what is on screen the way a person would: text that overlaps other text,
text cut off or pushed off the side, text too faint to read, and words left in the
other language. Returns a dict of problems; empty lists mean the screen is clean."""

AUDIT_JS = r"""
([lang, skip]) => {
  const vw = innerWidth, vh = innerHeight;
  // When a slide-up sheet or dialog is open, only what is in it is on screen.
  const dialogs = [...document.querySelectorAll('[aria-modal="true"], [role="dialog"]')].filter(d => d.getBoundingClientRect().height > 0);
  const root = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
  const out = {overlap: [], trunc: [], off: [], contrast: [], lang: []};
  const parseC = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return {r:p[0], g:p[1], b:p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); };
  const bgOf = el => { let e = el;
    while (e && e !== document.documentElement) { const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'img';
      const c = parseC(cs.backgroundColor); if (c && c.a > 0.85) return c; e = e.parentElement; }
    return parseC(getComputedStyle(document.body).backgroundColor) || {r:255,g:255,b:255,a:1}; };
  const hidden = el => { let e = el;
    while (e && e !== document.body) { const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || e.getAttribute('aria-hidden') === 'true') return true;
      e = e.parentElement; } return false; };
  const inScrollRow = el => { let e = el.parentElement;
    while (e && e !== document.body) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll') return true; e = e.parentElement; } return false; };
  // The part of an element that can actually be seen: scroll areas and clipped boxes cut it off.
  const visRect = el => { let r = el.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom;
    let e = el.parentElement;
    while (e && e !== document.documentElement) { const cs = getComputedStyle(e);
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const p = e.getBoundingClientRect(); L = Math.max(L, p.left); T = Math.max(T, p.top); R = Math.min(R, p.right); B = Math.min(B, p.bottom); }
      e = e.parentElement; }
    return {left: L, top: T, right: R, bottom: B, width: R - L, height: B - T}; };
  const skipLang = t => (skip || []).some(x => t.includes(x));
  const texts = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!own) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (hidden(el)) continue;
    const vr = visRect(el);
    if (vr.width > 1 && vr.height > 1) texts.push({el, r: vr, t: own.slice(0, 60)});
    const cs = getComputedStyle(el);
    if ((cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) ||
        (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2))
      out.trunc.push(own.slice(0, 60));
    if ((r.right > vw + 1 || r.left < -1) && !inScrollRow(el)) out.off.push(own.slice(0, 60));
    const fg = parseC(cs.color), bg = bgOf(el);
    if (fg && bg !== 'img' && fg.a > 0.3) {
      const a = fg.a, mix = {r: fg.r*a + bg.r*(1-a), g: fg.g*a + bg.g*(1-a), b: fg.b*a + bg.b*(1-a)};
      const L1 = lum(mix), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const big = parseFloat(cs.fontSize) >= 18 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
      if (ratio < (big ? 2.6 : 3.0)) out.contrast.push(own.slice(0, 40) + ' [' + ratio.toFixed(2) + ']');
    }
    if (skipLang(own)) continue;
    if (lang === 'en' && /[\u0980-\u09FF]/.test(own) && !/^বাংলা/.test(own)) out.lang.push(own.slice(0, 60));
    if (lang === 'bn') {
      const words = (own.match(/[A-Za-z][A-Za-z]{2,}/g) || []).filter(w => !/^(Omni|route|OmniRoute|OpenRouter|OpenAI|ElevenLabs|Gemini|Google|API|URL|https?|gpt|mini|flash|pro|turbo|tts|English|Nova|Alloy|Shimmer|Echo|Fable|Onyx|Coral|Sage|Ash|Ballad|Verse|Kore|Puck|Charon|Fenrir|Aoede|Leda|Orus|Zephyr|eleven|multilingual|preview|sk|Rahim|Karim|Admin|Farmer|Test|key|main|backup|test|fake|localhost|Rachel|Adam|Bella|audio|speech|transcriptions|omniroute|example|com|openrouter|openai|googleapis|generativelanguage|beta|eleven_v3|eleven_multilingual_v2)$/i.test(w));
      if (words.length) out.lang.push(own.slice(0, 60));
    }
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const A = texts[i], B = texts[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const x = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
    const y = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
    if (x > 3 && y > 3) out.overlap.push(A.t + ' <> ' + B.t);
  }
  for (const k in out) out[k] = [...new Set(out[k])].slice(0, 12);
  const mid = document.elementFromPoint(vw / 2, vh * 0.55), mb = mid ? bgOf(mid) : null;
  out.bgLum = mb && mb !== 'img' ? +lum(mb).toFixed(3) : null;
  return out;
}
"""


async def audit(pg, lang, skip=()):
    return await pg.evaluate(AUDIT_JS, [lang, list(skip)])


def report(ok, tag, res, skip=(), dark=None):
    """One check per kind of problem, so a failure names the screen and the words."""
    names = {"overlap": "no text overlaps other text", "trunc": "no text cut off",
             "off": "nothing pushed off the side", "contrast": "all text readable against its background",
             "lang": "no words left in the other language"}
    for k, label in names.items():
        if k in skip: continue
        ok(not res[k], f"{tag}: {label}", "; ".join(res[k]))
    if dark is not None and res.get("bgLum") is not None:
        ok(res["bgLum"] < 0.06 if dark else res["bgLum"] > 0.6, f"{tag}: background is {'dark' if dark else 'light'}", res["bgLum"])
