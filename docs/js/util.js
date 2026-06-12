// Pure helpers shared across modules.

// d3.forceLink rewrites link.source/target from ids to node objects; resolve either form.
export const lid = x => (x && x.id) || x;

// SVG path for a pointy-top hexagon of "radius" r, centred on (0,0).
export const hexPath = r => {
  let p = '';
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    p += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ',' + (r * Math.sin(a)).toFixed(2);
  }
  return p + 'Z';
};

// Relative time vs the mosaic's generation timestamp.
export const agoFrom = (genAt, iso) => {
  const d = Math.round((genAt - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : d < 60 ? 'a month ago' : Math.round(d / 30) + ' months ago';
};
