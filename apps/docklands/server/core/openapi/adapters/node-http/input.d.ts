import { NodeHTTPRequest } from '../../types';

export declare const getQuery: (req: NodeHTTPRequest, url: URL) => Record<string, string | string[]>;
export declare const getBody: (req: NodeHTTPRequest, maxBodySize?: number) => Promise<any>;
export declare const getMultipartBody: (req: NodeHTTPRequest) => Promise<FormData>;
