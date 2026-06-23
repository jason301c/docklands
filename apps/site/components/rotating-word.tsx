"use client";

import { useEffect, useState } from "react";

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

const INTERVAL_MS = 2200;

/**
 * Cycles the trailing word of the hero headline. The word is keyed so the
 * fade-and-rise animation (`animate-word-in`, defined in globals.css) re-runs on
 * every swap; it lives on its own line so width changes only re-center, never
 * reflow the sentence. Honors prefers-reduced-motion via the CSS media query.
 */
export function RotatingWord() {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setIndex((current) => (current + 1) % WORDS.length);
		}, INTERVAL_MS);
		return () => clearInterval(id);
	}, []);

	return (
		// `background-clip: text` only paints the gradient within the element's box,
		// so descenders (y, p, g) that hang below the tight display line box go
		// unpainted and look clipped. The padding-bottom on the gradient span itself
		// extends its paint box downward to cover them.
		<span className="mt-1 block">
			<span
				key={index}
				className="animate-word-in inline-block pb-[0.28em] text-gradient"
			>
				{WORDS[index]}
			</span>
		</span>
	);
}
