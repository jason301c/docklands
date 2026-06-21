import { ZodObject, ZodRawShape, ZodType, z } from 'zod';
import type { $ZodType, $ZodTypes } from 'zod/v4/core';
import type { $ZodTypeDef } from 'zod/v4/core/schemas';
export declare const instanceofZodType: (type: any) => type is $ZodTypes;
export declare const instanceofZodTypeKind: <Z extends $ZodTypeDef["type"]>(type: $ZodType, zodTypeKind: Z) => type is $ZodTypes;
export declare const instanceofZodTypeOptional: (type: $ZodType) => type is z.ZodOptional<$ZodTypes>;
export declare const instanceofZodTypeObject: (type: $ZodType) => type is z.ZodObject<z.ZodRawShape>;
export type ZodTypeLikeVoid = z.ZodVoid | z.ZodUndefined | z.ZodNever;
export declare const instanceofZodTypeLikeVoid: (type: $ZodType) => type is ZodTypeLikeVoid;
export declare const unwrapZodType: (type: $ZodType, unwrapPreprocess: boolean) => ZodType;
export declare const instanceofZodTypeLikeString: (_type: $ZodType) => boolean;
export declare const zodSupportsCoerce: boolean;
export type ZodTypeCoercible = z.ZodNumber | z.ZodBoolean | z.ZodBigInt | z.ZodDate;
export declare const instanceofZodTypeCoercible: (_type: $ZodType) => _type is ZodTypeCoercible;
export declare const coerceSchema: (schema: ZodObject<ZodRawShape>) => void;
/**
 * Safely check if a schema is optional without triggering parse/preprocessing.
 * Important for zod-form-data schemas where isOptional()/safeParse() would trigger form parsing.
 */
export declare const isSchemaOptional: (schema: $ZodType) => boolean;
/**
 * Detect if a schema is a zod-form-data file field (zfd.file()).
 * In Zod v4, zfd.file() creates: pipe(transform → custom) where custom validates instanceof File/Blob.
 */
export declare const instanceofZodFormDataFile: (_type: $ZodType) => boolean;
/** Check if an object schema contains any file fields */
export declare const schemaContainsFileField: (type: $ZodType) => boolean;
