/**
 * Color normalization utilities.
 * Backend returns colors in format {rgb: [r,g,b], lab: [l,a,b]}.
 */

/** Normalized primary color with both RGB and LAB data */
export interface PrimaryColor {
  rgb: [number, number, number];
  lab: [number, number, number];
}

/** Single palette color entry */
export interface PaletteColor {
  rgb: [number, number, number];
  lab: [number, number, number];
}

/**
 * Normalize palette colors in-place for detail view:
 *   [{rgb:[r,g,b], lab:[l,a,b]}, ...] → {colors: [{rgb, lab}, ...]}
 * No-op if colors are already normalized or missing.
 */
export function normalizeColorPalette(data: any): void {
  if (Array.isArray(data.colors) && data.colors.length && data.colors[0]?.rgb) {
    data.colors = { colors: data.colors.map((c: any) => ({ rgb: c.rgb, lab: c.lab })) }
  }
}

/**
 * Normalize primary_color to a consistent {rgb, lab} shape.
 *   {rgb: [r,g,b], lab: [l,a,b]} → {rgb, lab}  (new format)
 *   [r,g,b] → {rgb: [r,g,b], lab: null}         (legacy format)
 *   Falsy → null
 */
export function normalizePrimaryColor(primaryColor: any): PrimaryColor | null {
  if (!primaryColor) return null
  if (Array.isArray(primaryColor)) return { rgb: primaryColor as [number, number, number], lab: [0, 0, 0] }
  if (typeof primaryColor === 'object' && 'rgb' in primaryColor) {
    return {
      rgb: primaryColor.rgb as [number, number, number],
      lab: primaryColor.lab ? primaryColor.lab as [number, number, number] : [0, 0, 0],
    }
  }
  return null
}
