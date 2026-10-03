"use client";

/**
 * Jawdi's face — the assistant drawn as a person, not as an icon.
 *
 * Port of the mobile `JawdiFace` (same geometry, same palette) so the advisor is literally the
 * same someone on a phone and on a laptop. The difference is the motion: React Native animates
 * with `Animated`, the web with CSS keyframes, which lets the browser run the blink and the wave
 * off the main thread and lets `prefers-reduced-motion` switch them off declaratively — no
 * listener, no state, no re-render.
 *
 * Both eye states are always in the DOM; the blink alternates their opacity. That is why a
 * reader with motion disabled still sees open eyes: the "closed" group simply never surfaces.
 *
 * `wave={false}` drops the hand. A wave is a greeting: it belongs on the button and on the
 * opening of a conversation, not beside every single reply — ten messages would be ten hands
 * waving at once.
 */
import { useId } from "react";
import { Box } from "@mui/material";
import { keyframes } from "@mui/material/styles";

/** How the person is coloured. Warm brown skin, dark cropped hair, Jawdi-orange shirt. */
const SKIN = "#A86B3C";
const SKIN_SHADE = "#8A552E";
const HAIR = "#1F1812";
const SHIRT = "#E67E0A";
const INK = "#2B1C0E";

// Cast to string for `sx`'s animation shorthand — same reason as JawdiChat's keyframes.
/** One blink per 3.2 s cycle, shut for ~4% of it. The two groups cross-fade. */
const eyesOpen = keyframes`0%, 94%, 100% { opacity: 1 } 95%, 99% { opacity: 0 }` as unknown as string;
const eyesShut = keyframes`0%, 94%, 100% { opacity: 0 } 95%, 99% { opacity: 1 }` as unknown as string;
/** The hand waves over the first second of a 6 s cycle, then rests. */
const wave = keyframes`
  0% { transform: rotate(0deg) }
  3% { transform: rotate(20deg) }
  9% { transform: rotate(-20deg) }
  15% { transform: rotate(20deg) }
  20% { transform: rotate(0deg) }
  100% { transform: rotate(0deg) }
` as unknown as string;

export function JawdiFace({ size = 46, wave: waves = true }: { size?: number; wave?: boolean }) {
  // Several faces can share a page (button, header, empty state): the clip needs its own id.
  const clip = useId().replace(/:/g, "");

  return (
    <Box sx={{ position: "relative", width: waves ? size * 1.46 : size, height: size, flexShrink: 0 }}>
      <Box
        component="svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        sx={{ display: "block" }}
        aria-hidden
      >
        <defs>
          <clipPath id={clip}>
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {/* The cream disc the person stands on — the face must not sit on the green pill. */}
          <circle cx="50" cy="50" r="50" fill="#F7EFE2" />
          {/* Shoulders, then neck, then head: back to front. */}
          <ellipse cx="50" cy="106" rx="37" ry="28" fill={SHIRT} />
          <rect x="42" y="64" width="16" height="18" fill={SKIN_SHADE} />
          <circle cx="25" cy="50" r="5" fill={SKIN_SHADE} />
          <circle cx="75" cy="50" r="5" fill={SKIN_SHADE} />
          <circle cx="50" cy="46" r="24" fill={SKIN} />
          {/* Short cropped hair: a cap over the top third of the head. */}
          <path d="M 27 41 A 23 23 0 0 1 73 41 Z" fill={HAIR} />
          <path d="M 34 40 Q 40 37 46 40" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 54 40 Q 60 37 66 40" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <Box
            component="g"
            data-testid="jawdi-eyes-open"
            sx={{
              animation: `${eyesOpen} 3.2s steps(1, end) infinite`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 1 },
            }}
          >
            <ellipse cx="40" cy="48" rx="5.4" ry="4" fill="#FFFFFF" />
            <ellipse cx="60" cy="48" rx="5.4" ry="4" fill="#FFFFFF" />
            <circle cx="40.6" cy="48" r="2.5" fill={INK} />
            <circle cx="60.6" cy="48" r="2.5" fill={INK} />
          </Box>
          <Box
            component="g"
            data-testid="jawdi-eyes-closed"
            sx={{
              opacity: 0,
              animation: `${eyesShut} 3.2s steps(1, end) infinite`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0 },
            }}
          >
            <path d="M 35 48 Q 40 51 45 48" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <path d="M 55 48 Q 60 51 65 48" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </Box>
          <path d="M 50 50 q 1 5 3.5 6" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* The smile — the single most important stroke on the button. */}
          <path d="M 41 60 Q 50 68 59 60" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      </Box>

      {/* An open hand raised beside the head, pivoting at the wrist. */}
      {waves ? (
      <Box
        component="svg"
        viewBox="0 0 40 44"
        width={size * 0.52}
        height={size * 0.52}
        aria-hidden
        sx={{
          position: "absolute",
          left: size * 0.9,
          top: size * 0.02,
          transformOrigin: "50% 100%",
          animation: `${wave} 6s ease-in-out infinite`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        {/* Four fingers, then the thumb, then the palm over their roots. */}
        <rect x="11" y="9" width="4.4" height="14" rx="2.2" fill={SKIN} />
        <rect x="16" y="6" width="4.4" height="16" rx="2.2" fill={SKIN} />
        <rect x="21" y="6" width="4.4" height="16" rx="2.2" fill={SKIN} />
        <rect x="26" y="9" width="4.4" height="14" rx="2.2" fill={SKIN} />
        <rect x="5" y="20" width="5" height="12" rx="2.5" fill={SKIN} transform="rotate(-24 7.5 26)" />
        <rect x="9" y="18" width="22" height="20" rx="9" fill={SKIN} />
      </Box>
      ) : null}
    </Box>
  );
}
