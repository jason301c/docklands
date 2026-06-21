import { TRPCProcedureType } from '@trpc/server';
import { ZodObject } from 'zod';
import { OpenApiMethod, OpenApiProcedure, OpenApiProcedureRecord, ResolvedOpenApiMeta } from '../types';

export declare const getMethod: (procedure: OpenApiProcedure) => OpenApiMethod;
export declare const getInputOutputParsers: (procedure: OpenApiProcedure) => {
    inputParser: ZodObject;
    outputParser: ZodObject | undefined;
    hasInputsDefined: boolean;
};
export declare const forEachOpenApiProcedure: <TMeta = Record<string, unknown>>(procedureRecord: OpenApiProcedureRecord, callback: (values: {
    path: string;
    type: TRPCProcedureType;
    procedure: OpenApiProcedure;
    meta: {
        openapi: ResolvedOpenApiMeta;
    } & TMeta;
}) => void) => void;
