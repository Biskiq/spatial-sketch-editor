/** Authored materials never participate in instrument paint. */
export const STAGE_PAINT = Object.freeze({ ink: 0x1b201c, hover: 0x4f8f6c, selection: 0xd4ad45 });
export const STAGE_PAINT_CSS = Object.fromEntries(Object.entries(STAGE_PAINT).map(([key, value]) => [key, `#${value.toString(16).padStart(6, '0')}`])) as Readonly<Record<keyof typeof STAGE_PAINT, string>>;
