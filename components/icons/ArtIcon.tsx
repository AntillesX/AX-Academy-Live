import { ART_LABELS, ART_OVERRIDES, type ArtName } from "@/lib/art";
import { SCENES } from "@/components/icons/scenes";

const SIZES = { sm: 64, md: 96, lg: 128 } as const;
export type ArtSize = keyof typeof SIZES;

type Props = {
  name: ArtName;
  size?: ArtSize;
  /** Show the label under the icon. When false the label is still exposed to screen readers. */
  showLabel?: boolean;
  /** Override the default label from ART_LABELS. */
  label?: string;
  className?: string;
};

/**
 * One standard tile for every course and game: fixed sizes, 2px cyan border, rounded corners, hover lift + glow
 * (also triggered by a parent with the `group` class, e.g. a clickable card), and an accessible text label.
 */
export default function ArtIcon({ name, size = "md", showLabel = false, label, className = "" }: Props) {
  const scene = SCENES[name];
  const text = label ?? ART_LABELS[name];
  const px = SIZES[size];
  const override = ART_OVERRIDES[name];

  return (
    <figure className={`group inline-flex flex-col items-center gap-1.5 ${className}`}>
      <span
        style={{ width: px, height: px, background: `linear-gradient(135deg, ${scene.tile[0]}, ${scene.tile[1]})` }}
        className="relative block shrink-0 overflow-hidden rounded-2xl border-2 border-cyan-300/60 shadow-[0_6px_18px_rgba(2,6,23,0.6)] transition duration-200 group-hover:-translate-y-1 group-hover:border-cyan-200 group-hover:shadow-[0_12px_28px_rgba(6,182,212,0.55)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      >
        {override ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={override} alt={showLabel ? "" : text} width={px} height={px} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 96 96" width={px} height={px} role={showLabel ? undefined : "img"} aria-label={showLabel ? undefined : text} aria-hidden={showLabel ? true : undefined} focusable="false">
            {scene.art}
          </svg>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent" />
      </span>
      {showLabel ? <figcaption className="max-w-[9rem] text-center text-sm font-bold leading-tight text-white">{text}</figcaption> : null}
    </figure>
  );
}
