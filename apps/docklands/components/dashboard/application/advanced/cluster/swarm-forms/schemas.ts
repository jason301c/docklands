import { z } from "zod";

/**
 * An optional number whose form-held (input) type stays `string | number` so it
 * binds cleanly to a text/number `<Input>`, while parsing to a `number`. Plain
 * `z.coerce.number()` has an `unknown` input type, which doesn't spread onto an
 * `<Input value>`.
 */
export const optionalNumber = z
	.union([z.string(), z.number()])
	.transform((val) => (val === "" ? undefined : Number(val)))
	.optional();

/**
 * Swarm update/rollback configs share a byte-identical shape (Docker's
 * `UpdateConfig`/`RollbackConfig` carry the same fields), so the schema is
 * defined once and imported by both the update-config and rollback-config forms.
 */
export const swarmConfigFormSchema = z.object({
	Parallelism: optionalNumber,
	Delay: optionalNumber,
	FailureAction: z.string().optional(),
	Monitor: optionalNumber,
	MaxFailureRatio: optionalNumber,
	Order: z.string().optional(),
});
