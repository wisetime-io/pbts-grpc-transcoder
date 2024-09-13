// Copyright (c) 2020 WiseTime. All rights reserved.
//
// This is the API for the grpc/http-transcoder module.
// The module provides gRPC to HTTP/1 and JSON transcoding.

import { enableAllPlugins } from "immer"

// Required for IE11 support https://immerjs.github.io/immer/docs/installation#pick-your-immer-version
enableAllPlugins()

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

