import { z } from 'zod';
export const instanceofZodType = (type) => {
    return !!type?._zod?.def?.type;
};
export const instanceofZodTypeKind = (type, zodTypeKind) => {
    return type?._zod?.def?.type === zodTypeKind;
};
export const instanceofZodTypeOptional = (type) => {
    return instanceofZodTypeKind(type, 'optional');
};
export const instanceofZodTypeObject = (type) => {
    return instanceofZodTypeKind(type, 'object');
};
export const instanceofZodTypeLikeVoid = (type) => {
    return (instanceofZodTypeKind(type, 'void') ||
        instanceofZodTypeKind(type, 'undefined') ||
        instanceofZodTypeKind(type, 'never'));
};
export const unwrapZodType = (type, unwrapPreprocess) => {
    // TODO: Allow parsing array query params
    if (instanceofZodTypeKind(type, 'array')) {
        return unwrapZodType(type.element, unwrapPreprocess);
    }
    if (instanceofZodTypeKind(type, 'enum')) {
        return unwrapZodType(z.string(), unwrapPreprocess);
    }
    if (instanceofZodTypeKind(type, 'nullable')) {
        return unwrapZodType(type.unwrap(), unwrapPreprocess);
    }
    if (instanceofZodTypeKind(type, 'optional')) {
        return unwrapZodType(type.unwrap(), unwrapPreprocess);
    }
    if (instanceofZodTypeKind(type, 'default')) {
        return unwrapZodType(type.unwrap(), unwrapPreprocess);
    }
    if (instanceofZodTypeKind(type, 'lazy')) {
        return unwrapZodType(type.def.getter(), unwrapPreprocess);
    }
    if (instanceofZodTypeKind(type, 'pipe') && unwrapPreprocess) {
        return unwrapZodType(type.def.out, unwrapPreprocess);
    }
    return type;
};
export const instanceofZodTypeLikeString = (_type) => {
    const type = unwrapZodType(_type, false);
    if (instanceofZodTypeKind(type, 'pipe')) {
        return true;
    }
    // TODO improve this
    if (instanceofZodTypeKind(type, 'union')) {
        return !type._def.options.some((option) => !instanceofZodTypeLikeString(option));
    }
    if (instanceofZodTypeKind(type, 'intersection')) {
        return (instanceofZodTypeLikeString(type.def.left) &&
            instanceofZodTypeLikeString(type.def.right));
    }
    if (instanceofZodTypeKind(type, 'literal')) {
        return typeof type.value === 'string';
    }
    if (instanceofZodTypeKind(type, 'enum')) {
        return !Object.values(type.enum).some((value) => typeof value === 'number');
    }
    return instanceofZodTypeKind(type, 'string');
};
export const zodSupportsCoerce = 'coerce' in z;
export const instanceofZodTypeCoercible = (_type) => {
    const type = unwrapZodType(_type, false);
    return (instanceofZodTypeKind(type, 'number') ||
        instanceofZodTypeKind(type, 'boolean') ||
        instanceofZodTypeKind(type, 'bigint') ||
        instanceofZodTypeKind(type, 'date'));
};
export const coerceSchema = (schema) => {
    Object.values(schema.shape).forEach((shapeSchema) => {
        const unwrappedShapeSchema = unwrapZodType(shapeSchema, false);
        if (instanceofZodTypeCoercible(unwrappedShapeSchema))
            unwrappedShapeSchema._def.coerce = true;
        else if (instanceofZodTypeObject(unwrappedShapeSchema))
            coerceSchema(unwrappedShapeSchema);
    });
};
/**
 * Safely check if a schema is optional without triggering parse/preprocessing.
 * Important for zod-form-data schemas where isOptional()/safeParse() would trigger form parsing.
 */
export const isSchemaOptional = (schema) => {
    if (instanceofZodTypeKind(schema, 'optional'))
        return true;
    if (instanceofZodTypeKind(schema, 'nullable'))
        return true;
    if (instanceofZodTypeKind(schema, 'default'))
        return true;
    if (instanceofZodTypeKind(schema, 'pipe')) {
        return isSchemaOptional(schema.def.out);
    }
    // Zod v3 compat: check ZodEffects inner schema
    const def = schema?._def;
    if (def?.typeName === 'ZodEffects') {
        return isSchemaOptional(def.schema);
    }
    return false;
};
/**
 * Detect if a schema is a zod-form-data file field (zfd.file()).
 * In Zod v4, zfd.file() creates: pipe(transform → custom) where custom validates instanceof File/Blob.
 */
export const instanceofZodFormDataFile = (_type) => {
    const type = unwrapZodType(_type, false);
    // Zod v4: pipe(transform → custom) pattern from zfd.file()
    if (instanceofZodTypeKind(type, 'pipe')) {
        const out = type.def.out;
        if (instanceofZodTypeKind(out, 'custom'))
            return true;
        if (instanceofZodTypeKind(out, 'any'))
            return true;
        return instanceofZodFormDataFile(out);
    }
    // Zod v3 compat: ZodEffects(preprocess) -> ZodEffects(refinement) -> ZodAny
    const def = type?._def;
    if (def?.typeName === 'ZodEffects' && def.effect?.type === 'preprocess') {
        const inner = def.schema;
        if (inner?._def?.typeName === 'ZodEffects' && inner._def.effect?.type === 'refinement') {
            if (inner._def.schema?._def?.typeName === 'ZodAny')
                return true;
        }
        if (inner?._def?.typeName === 'ZodAny')
            return true;
        if (inner?._def?.typeName === 'ZodUnion') {
            return inner._def.options.some((opt) => instanceofZodFormDataFile(opt));
        }
    }
    return false;
};
/** Check if an object schema contains any file fields */
export const schemaContainsFileField = (type) => {
    const unwrapped = unwrapZodType(type, true);
    if (!instanceofZodTypeObject(unwrapped))
        return false;
    return Object.values(unwrapped.shape).some((fieldSchema) => {
        const field = fieldSchema;
        return instanceofZodFormDataFile(field) || instanceofZodFormDataFile(unwrapZodType(field, false));
    });
};
