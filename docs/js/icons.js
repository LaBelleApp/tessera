// One compact glyph per field, drawn in a 24x24 box (stroke/fill set on the group).
export const ICONS = {
  'client-app':'<rect x="7" y="3" width="10" height="18" rx="2"/><line x1="10.5" y1="18" x2="13.5" y2="18"/>',
  'internal-app':'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><rect x="9.4" y="10.6" width="5.2" height="4.9" rx="0.9"/><path d="M10.6 10.6v-1.3a1.4 1.4 0 0 1 2.8 0v1.3"/>',
  'framework':'<polygon points="12,5 21,10 12,15 3,10"/><polyline points="3,14 12,19 21,14"/>',
  'package':'<path d="M12 3 21 7.5V16.5L12 21 3 16.5V7.5Z"/><polyline points="3,7.5 12,12 21,7.5"/><line x1="12" y1="12" x2="12" y2="21"/>',
  'template':'<rect x="8" y="3" width="11" height="14" rx="2"/><rect x="5" y="7" width="11" height="14" rx="2"/>',
  'cli':'<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="7,10 10,12.5 7,15"/><line x1="12" y1="15.2" x2="16" y2="15.2"/>',
  'tool':'<circle cx="12" cy="12" r="3.4"/><line x1="12" y1="2.5" x2="12" y2="5.5"/><line x1="12" y1="18.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5.5" y2="12"/><line x1="18.5" y1="12" x2="21.5" y2="12"/><line x1="5.2" y1="5.2" x2="7.3" y2="7.3"/><line x1="16.7" y1="16.7" x2="18.8" y2="18.8"/><line x1="18.8" y1="5.2" x2="16.7" y2="7.3"/><line x1="7.3" y1="16.7" x2="5.2" y2="18.8"/>',
  'site':'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/>',
  'service':'<rect x="4" y="4" width="16" height="7" rx="1"/><rect x="4" y="13" width="16" height="7" rx="1"/><circle cx="7" cy="7.5" r="0.6"/><circle cx="7" cy="16.5" r="0.6"/>',
  'distribution':'<path d="M12 3v10"/><path d="M8 7l4-4 4 4"/><path d="M5 14v5h14v-5"/>',
  'experiment':'<path d="M9 3h6M10 3v6l-5 9a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 18l-5-9V3"/><line x1="8" y1="14" x2="16" y2="14"/>',
  'skill':'<path d="M12 1.8 14.7 9.3 22 12 14.7 14.7 12 22.2 9.3 14.7 2 12 9.3 9.3Z"/>',
};
// Field keys rendered as a FILLED emblem rather than a line glyph (extension point).
export const EMBLEMS = new Set();
