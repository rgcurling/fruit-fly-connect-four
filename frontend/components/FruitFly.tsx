/**
 * Stylised top-down fruit fly, drawn as inline SVG.
 *
 * Deliberately simple: a few gradients, translucent wings and a wing-beat
 * animation. It is scenery, not a model of anything.
 */

interface FruitFlyProps {
  /** Beat the wings faster and brighten the eyes while the fly is deciding. */
  thinking?: boolean;
  className?: string;
}

export default function FruitFly({ thinking = false, className = "" }: FruitFlyProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="img"
      aria-label="Stylised fruit fly"
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id="fly-eye" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff8a7a" />
          <stop offset="45%" stopColor="#e5342c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>

        <linearGradient id="fly-thorax" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d7a24a" />
          <stop offset="55%" stopColor="#9a6b22" />
          <stop offset="100%" stopColor="#4a3210" />
        </linearGradient>

        <linearGradient id="fly-abdomen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c98f36" />
          <stop offset="60%" stopColor="#6d4a17" />
          <stop offset="100%" stopColor="#241703" />
        </linearGradient>

        <linearGradient id="fly-wing" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#e2f2ff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#9ec8ef" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
        </linearGradient>

        <filter id="fly-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Wings sit behind the body. */}
      <g opacity={thinking ? 0.9 : 0.7}>
        <ellipse
          cx="46"
          cy="44"
          rx="34"
          ry="13"
          fill="url(#fly-wing)"
          stroke="rgba(226,242,255,0.35)"
          strokeWidth="0.75"
          transform="rotate(-24 46 44)"
          className={thinking ? "animate-wing-left" : ""}
        />
        <ellipse
          cx="114"
          cy="44"
          rx="34"
          ry="13"
          fill="url(#fly-wing)"
          stroke="rgba(226,242,255,0.35)"
          strokeWidth="0.75"
          transform="rotate(24 114 44)"
          className={thinking ? "animate-wing-right" : ""}
        />
      </g>

      {/* Legs. */}
      <g
        stroke="#2a1c07"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      >
        <path d="M66 62 L44 76 L36 92" />
        <path d="M70 70 L52 88 L48 104" />
        <path d="M94 62 L116 76 L124 92" />
        <path d="M90 70 L108 88 L112 104" />
        <path d="M72 54 L52 50 L40 40" />
        <path d="M88 54 L108 50 L120 40" />
      </g>

      {/* Abdomen with the classic banding. */}
      <ellipse cx="80" cy="84" rx="20" ry="27" fill="url(#fly-abdomen)" />
      <g stroke="#1b1104" strokeWidth="2.6" opacity="0.55" fill="none">
        <path d="M62 78 Q80 86 98 78" />
        <path d="M64 88 Q80 96 96 88" />
        <path d="M68 98 Q80 104 92 98" />
      </g>

      {/* Thorax. */}
      <ellipse cx="80" cy="56" rx="19" ry="17" fill="url(#fly-thorax)" />
      <ellipse cx="80" cy="50" rx="13" ry="8" fill="#e0b060" opacity="0.28" />

      {/* Head and compound eyes. */}
      <ellipse cx="80" cy="34" rx="15" ry="12" fill="#3b2a0c" />
      <g filter={thinking ? "url(#fly-glow)" : undefined}>
        <ellipse cx="69" cy="32" rx="11" ry="12.5" fill="url(#fly-eye)" />
        <ellipse cx="91" cy="32" rx="11" ry="12.5" fill="url(#fly-eye)" />
      </g>
      {/* Specular highlights make the eyes read as glossy. */}
      <ellipse cx="65.5" cy="27" rx="3.1" ry="3.6" fill="#ffd9d2" opacity="0.75" />
      <ellipse cx="87.5" cy="27" rx="3.1" ry="3.6" fill="#ffd9d2" opacity="0.75" />

      {/* Aristae. */}
      <g stroke="#2a1c07" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M74 24 L69 14" />
        <path d="M86 24 L91 14" />
      </g>
    </svg>
  );
}
