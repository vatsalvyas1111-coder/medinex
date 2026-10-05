/** Slowly drifting gradient mesh + subtle film grain (SVG feTurbulence). Pure CSS/SVG, no images. */
export function Background() {
  return (
    <>
      <div className="mesh" aria-hidden="true"><i /><i /><i /><i /></div>
      <svg className="grain" width="100%" height="100%" aria-hidden="true">
        <filter id="grainf"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#grainf)" />
      </svg>
    </>
  );
}
