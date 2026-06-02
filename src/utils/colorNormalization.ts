/**
 * Color normalization utilities.
 * Backend returns colors in format {rgb: [r,g,b], lab: [l,a,b]}.
 * Frontend needs {colors: [[r,g,b], ...]}.
 */

/**
 * Mutates `data.colors` in-place:
 *   [{rgb:[r,g,b], lab:[l,a,b]}, ...] → {colors: [[r,g,b], ...]}
 * No-op if colors are already normalized or missing.
 */
export function normalizeColorPalette(data: any): void {
  if (Array.isArray(data.colors) && data.colors.length && data.colors[0]?.rgb) {
    data.colors = { colors: data.colors.map((c: any) => c.rgb) }
  }
}

/**
 * Extracts rgb array from a primary_color object.
 *   {rgb: [r,g,b]} → [r,g,b]
 *   Already an array → returned as-is
 *   Falsy → null
 */
export function normalizePrimaryColor(primaryColor: any): [number, number, number] | null {
  if (!primaryColor) return null
  if (Array.isArray(primaryColor)) return primaryColor as [number, number, number]
  if (typeof primaryColor === 'object' && 'rgb' in primaryColor) return primaryColor.rgb as [number, number, number]
  return primaryColor
}
