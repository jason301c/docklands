"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The punchline of self-hosting: it runs on whatever hardware you already have.
const WORDS = [
	"anything",
	"a Mac Mini",
	"a $5 VPS",
	"a Raspberry Pi",
	"bare metal",
	"a spare laptop",
	"your homelab",
	"any Linux box",
];

// How long a word sits sharp and readable before it starts charging. Comfortably
// covers the resolve-in (~0.6s) plus a steady beat to actually read it.
const DWELL_MS = 2000;
// Must match the `word-charge` animation duration in globals.css: the word gathers
// energy and then bursts into blur over this window, at which point we swap.
const CHARGE_MS = 500;

/**
 * Cycles the trailing word of the hero headline with a two-phase "charge" effect:
 * the outgoing word gathers energy (brightens, glows) then bursts into blur, and
 * the incoming word condenses out of that blur and settles into focus.
 *
 * Driven by timers rather than `onAnimationEnd` so the cycle keeps advancing even
 * under `prefers-reduced-motion`, where the CSS animations collapse to a plain cut
 * (see globals.css). The word lives on its own centered line so width changes only
 * re-center, never reflow the sentence.
 */
export function RotatingWord() {
	const [index, setIndex] = useState(0);
	const [charging, setCharging] = useState(false);

	useEffect(() => {
		if (charging) {
			// Peak charge reached: swap to the next word, which remounts and resolves.
			const id = setTimeout(() => {
				setIndex((current) => (current + 1) % WORDS.length);
				setCharging(false);
			}, CHARGE_MS);
			return () => clearTimeout(id);
		}
		// Word is sitting sharp; after the dwell, begin charging it up.
		const id = setTimeout(() => setCharging(true), DWELL_MS);
		return () => clearTimeout(id);
	}, [charging]);

	return (
		// `background-clip: text` only paints the gradient within the element's box,
		// so descenders (y, p, g) that hang below the tight display line box go
		// unpainted and look clipped. The padding-bottom on the gradient span itself
		// extends its paint box downward to cover them.
		<span className="mt-1 block">
			<span
				// Keyed on `index` so the incoming word remounts and re-runs the resolve
				// animation; the charge animation is toggled in place on the same node.
				key={index}
				className={cn(
					"inline-block pb-[0.28em] text-gradient will-change-[filter,transform,opacity]",
					charging ? "animate-word-charge" : "animate-word-resolve",
				)}
			>
				{WORDS[index]}
			</span>
		</span>
	);
}
