// Small line icons, drawn like pencil marks.
const S = (d: string, extra?: any) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" {...extra}>
    <path d={d} />
  </svg>
);

export const IUndo = S('M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3');
export const IRedo = S('m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3');
export const ISelect = S('M5 3l13 8-6 1.5L9 19 5 3z');
export const IPen = S('M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4zM14 7l3 3');
export const IPlace = S('M12 3v4M12 17v4M3 12h4M17 12h4M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0');
export const ISlice = S('M4 20 20 4M7 4h13v13');
export const ILift = S('M4 15h16M7 10h10M10 5h4M12 15v6');
export const IEye = S('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0');
export const IPlan = S('M4 4h16v16H4zM4 12h9V4M13 12v8');
export const ICube = S('M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12 4 7.5M12 12v9');
export const IFrame = S('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5');
export const IPerson = S('M12 5m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 7v8M8 21l4-6 4 6M7 11h10');
export const IHelp = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01');
export const IClock = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2');
export const ITray = S('M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6l2-8z');
export const IKnot = S('M12 12m-7 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0');
export const IPlay = S('M7 4v16l13-8L7 4z');
export const IPause = S('M8 4v16M16 4v16');
export const IClose = S('M6 6l12 12M18 6 6 18');
export const IPin = S('M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 10m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0');
export const ITruth = S('M5 12l4 4L19 6');
export const IMenu = S('M4 7h16M4 12h16M4 17h16');
export const ISwatch = S('M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 3.7c.7.5.5 2.3-3 2.3z');
export const ITrash = S('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3');

export const Logo = () => (
  <svg viewBox="0 0 32 32" fill="none">
    <rect x="2" y="2" width="28" height="28" rx="7" fill="#1f1c19" />
    <path d="M8 22 L8 12 Q16 5 24 12 L24 22" stroke="#fbf9f5" stroke-width="2" stroke-linecap="round" fill="none" />
    <path d="M13 22 L13 16 Q16 13.6 19 16 L19 22" stroke="#2f4bd8" stroke-width="2" stroke-linecap="round" fill="none" />
    <path d="M6 22 H26" stroke="#fbf9f5" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 2.5" />
  </svg>
);
