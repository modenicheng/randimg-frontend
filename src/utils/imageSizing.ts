/**
 * Compute display size for an image based on its aspect ratio.
 * Uses window dimensions to fit images within viewport constraints.
 *
 * - aspect_ratio < 0.7 (tall): height = 80vh, width = height * ratio
 * - aspect_ratio < 1.25 (medium): width = 30vw, height = width / ratio
 * - else (wide): width = 50vw, height = width / ratio
 */
export function computeImageDisplaySize(aspectRatio: number): { width: number; height: number } {
  if (aspectRatio < 0.7) {
    const height = 0.8 * window.innerHeight;
    const width = height * aspectRatio;
    return { width, height };
  } else if (aspectRatio < 1.25) {
    const width = 0.3 * window.innerWidth;
    const height = width / aspectRatio;
    return { width, height };
  } else {
    const width = 0.5 * window.innerWidth;
    const height = width / aspectRatio;
    return { width, height };
  }
}
