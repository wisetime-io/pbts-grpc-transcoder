// Copyright (c) 2020 WiseTime. All rights reserved.

import { Either, map, chain, fromNullable } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/pipeable"
import * as Protobuf from "protobufjs/light"
import readConfiguration , { TranscodingConfig } from "./config"
import { ConvertibleToJson, HttpMethod, HttpRequest, Json } from "./"
import transcodePath from "./path"
import transcodeQueryString from "./queryString"
import transcodeBody from "./body"

export type TranscodingBundle = {
  config: TranscodingConfig,

  // Fields still pending transcoding or left untranscoded.
  notTranscoded: Json,

  // Transcoding results.
  transcoded: {
    method: HttpMethod,
    urlEncodedPath?: string,
    urlEncodedQueryString?: string,
    body?: string,
  },
}

const createTranscodingBundle = (requestMessage: ConvertibleToJson) => (config: TranscodingConfig): TranscodingBundle => ({
  config,
  notTranscoded: requestMessage.toJSON(),  // Initialise with all fields.
  transcoded: {
    method: config.method,
  },
})

const getHttpRequest = (bundle: TranscodingBundle): Either<Error, HttpRequest> =>
  pipe(
    fromNullable(
      new Error("Invalid transcoding bundle: URL encoded path is undefined.")
    )(bundle.transcoded.urlEncodedPath)
    ,
    map(urlEncodedPath => ({
      urlEncodedPath,
      urlEncodedQueryString: bundle.transcoded.urlEncodedQueryString,
      method: bundle.transcoded.method,
      body: bundle.transcoded.body,
    }))
  )

/**
 * Transcode a gRPC call to a HTTP/1 & JSON request.
 * Only unary RPCs are supported.
 *
 * Spec: https://github.com/googleapis/googleapis/blob/master/google/api/http.proto
 *
 * @param descriptorRoot - Root of the protobuf descriptor that contains the necessary information for transcoding
 * @param serviceName - The gRPC service that contains the call to transcode
 * @param methodName - The gRPC method call to transcode
 * @param requestMessage - Request message that can be converted to JSON, e.g. a Protobuf message
 */
const transcodeRpc = (
  descriptorRoot: Protobuf.Root,
  serviceName: string,
  methodName: string,
  requestMessage: ConvertibleToJson
): Either<Error, HttpRequest> =>
  pipe(
    readConfiguration(descriptorRoot, serviceName, methodName),
    map(createTranscodingBundle(requestMessage)),
    chain(transcodePath),
    map(transcodeBody),
    map(transcodeQueryString),
    chain(getHttpRequest),
  )

export default transcodeRpc

