(sel) => {
  const root = sel ? document.querySelector(sel) : document;
  if (!root) return { root: false };
  const vis = (s) => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const svgs = [...root.querySelectorAll('svg')].filter(vis);
  const isNew = (s) => {
    const cs = [...s.querySelectorAll('circle')];
    return cs.length === 3 && cs.every(c => c.getAttribute('r') === '3.4') &&
      [...s.querySelectorAll('path')].some(p => (p.getAttribute('d') || '').startsWith('M6.45 14.18'));
  };
  const newOnes = svgs.filter(isNew);
  const filled = newOnes.every(s => [...s.querySelectorAll('circle')].every(c => { const f = c.getAttribute('fill'); return f && f !== 'none'; }));
  // old Feather share-2: three r=3 circles; old upload arrow: polyline 17 8 12 3 7 8
  const old = svgs.filter(s => {
    const cs = [...s.querySelectorAll('circle')];
    if (cs.length === 3 && cs.every(c => c.getAttribute('r') === '3')) return true;
    return [...s.querySelectorAll('polyline')].some(p => (p.getAttribute('points') || '').split(' ').filter(Boolean).join(' ') === '17 8 12 3 7 8');
  });
  return { root: true, n: newOnes.length, filled, old: old.length,
    colors: newOnes.map(s => s.querySelector('circle').getAttribute('fill')),
    sizes: newOnes.map(s => Math.round(s.getBoundingClientRect().width)) };
}
