// Copyright (c) 2020 WiseTime. All rights reserved.
//
// This is the API for the grpc/http-transcoder module.
// The module provides gRPC to HTTP/1 and JSON transcoding.

export type HttpRequest = {
  urlEncodedPath: string,
  urlEncodedQueryString: string | undefined,
  method: HttpMethod,
  body: string | undefined,
}

export type Json = { [k: string]: any }
export type ConvertibleToJson = { toJSON(): Json }
export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH"

export { default } from "./transcoder"

