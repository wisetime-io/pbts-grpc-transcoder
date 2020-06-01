// Copyright (c) 2020 WiseTime. All rights reserved.

import * as R from "ramda"
import produce from "immer"
import { pipe } from "fp-ts/lib/pipeable"
import * as IO from "fp-ts/lib/IO"
import * as O from "fp-ts/lib/Option"
import * as E from "fp-ts/lib/Either"
import { Either, fold, getOrElse } from "fp-ts/lib/Either"
import * as TE from "fp-ts/lib/TaskEither"
import { TaskEither } from "fp-ts/lib/TaskEither"
import { retrying } from "retry-ts/lib/Task"
import { RPCImpl } from "protobufjs"
import * as Protobuf from "protobufjs/light"
import transcodeRpc from "../http-transcoder"
import { RetryPolicy } from "./retry"
import { HttpRequest } from "../http-transcoder"
import { ErrorResponse } from "./ErrorResponse"
import { capDelay, exponentialBackoff, limitRetries, monoidRetryPolicy, RetryStatus } from "retry-ts"
import { warn } from "fp-ts/lib/Console"

export type Fetch = (url: RequestInfo, init?: RequestInit) => Promise<Response>

// Holds the information that is required to execute the request
type ExecutionContext = {
  requestMessage: Protobuf.Message<{}>,
  responseType: Protobuf.Type,
  transcodedRequest?: HttpRequest,
  fetchUrl?: string,
  fetchRequest?: RequestInit,
  fetchResponse?: Response,
}

const transcode = (descriptorRoot: Protobuf.Root, serviceName: string, methodName: string) =>
  (context: ExecutionContext): Either<Error, ExecutionContext> =>
    pipe(
      transcodeRpc(descriptorRoot, serviceName, methodName, context.requestMessage),
      E.map(httpRequest => produce(context, draft => { draft.transcodedRequest = httpRequest })),
    )

const getFetchUrl = (baseUrl: string) => (context: ExecutionContext): ExecutionContext => {
  const queryString = context.transcodedRequest?.urlEncodedQueryString === undefined ? ""
    : `?${context.transcodedRequest?.urlEncodedQueryString}`
  const fetchUrl = `${baseUrl}${context.transcodedRequest?.urlEncodedPath}${queryString}`
  return produce(context, draft => { draft.fetchUrl = fetchUrl })
}

const getFetchRequest = (configureRequest: () => RequestInit) => (context: ExecutionContext): ExecutionContext => {
  const fetchRequest: RequestInit = produce(configureRequest(), r => {
    r.body = context.transcodedRequest?.body
    r.method = context.transcodedRequest?.method
  })
  return produce(context, draft => { draft.fetchRequest = fetchRequest })
}

const executeFetch = (fetch: Fetch) => (context: ExecutionContext): TaskEither<Error, ExecutionContext> =>
  pipe(
    TE.tryCatch(() => fetch(context.fetchUrl ?? "", context.fetchRequest), E.toError),
    TE.map(response => produce(context, draft => { draft.fetchResponse = response }))
  )

const validateResponseOk = (context: ExecutionContext): TaskEither<Error, ExecutionContext> => {
  if (context.fetchResponse === undefined) return TE.left(new Error("Fetch response is undefined"))
  if (context.fetchResponse.ok) return TE.right(context)
  return TE.left(new ErrorResponse(context.fetchResponse))
}

const encodeResponse = (context: ExecutionContext): TaskEither<Error, Uint8Array> =>
  pipe(
    TE.tryCatch(() => context.fetchResponse!.json(), E.toError),
    TE.map(json => context.responseType.create(json)),
    TE.map(message => context.responseType.encode(message).finish()),
  )

const shouldRetry = (retryPolicy: RetryPolicy) => <T>(result: Either<Error, T>): boolean =>
  pipe(
    result,
    E.map(_ => false),
    getOrElse(error => {
      if (error instanceof ErrorResponse) {
        return retryPolicy.shouldRetry(error.response)
      }
      return false
    }),
  )

const logRetry = (serviceName: string, methodName: string, status: RetryStatus) => TE.rightIO(
  pipe(
    status.previousDelay,
    O.map(delay => `Retrying ${serviceName}.${methodName} RPC call in ${delay} milliseconds...`),
    O.fold(
      () => IO.of(undefined),
      warn,
    ),
  )
)

const beforeRetry = (status: RetryStatus, willRetry: () => Promise<void>): TaskEither<Error, void> =>
  status.iterNumber > 0
    ? TE.tryCatch(willRetry, reason => new Error(String(reason)))
    : TE.right(undefined)

const didGiveUp = (error: Error, retryPolicy: RetryPolicy): boolean => {
  if (error instanceof ErrorResponse) {
    return retryPolicy.shouldRetry(error.response)
  }
  return false
}

/**
 * Create a gRPC executor that performs RPC calls via HTTP/1 with JSON payloads.
 *
 * @param fetch - Fetch function to use when making HTTP requests.
 * @param retryPolicy - How to handle failed RPC calls.
 * @param baseUrl - Base URL to use when making HTTP requests.
 * @param protobufDescriptor - A protobuf JSON descriptor that describes the gRPC service.
 * @param configureRequest - Function to use to initialise the HTTP request. A convenience emptyRequestConfig is available.
 * @param service - The gRPC service that will be used to make RPC calls
 */
const createHttpExecutor = (
  fetch: Fetch,
  retryPolicy: RetryPolicy,
  baseUrl: string,
  protobufDescriptor: Record<string, any>,
  configureRequest: () => RequestInit,
  service: typeof Protobuf.rpc.Service,
): RPCImpl => (
  method,
  requestData,
  callback
): void => {
  const descriptorRoot = Protobuf.Root.fromJSON(protobufDescriptor)
  const { methods } = descriptorRoot.lookupService(service.name)

  const initialContext: Either<Error, ExecutionContext> = E.tryCatch(() => {
    const requestType = descriptorRoot.lookupType(methods[method.name].requestType)
    const requestMessage = requestType.decode(requestData)
    const responseType = descriptorRoot.lookupType(methods[method.name].responseType)
    return {
      requestMessage,
      responseType,
    }
  }, E.toError)

  const transcodeRequest = () => pipe(
    initialContext,
    E.chain(transcode(descriptorRoot, service.name, method.name)),
    E.map(getFetchUrl(baseUrl)),
    E.map(getFetchRequest(configureRequest)),
  )

  const performRequest: () => TaskEither<Error, Uint8Array> = () => pipe(
    TE.fromEither(transcodeRequest()),
    TE.chain(executeFetch(fetch)),
    TE.chain(validateResponseOk),
    TE.chain(encodeResponse),
  )

  const fetchWithRetry = retrying(
    capDelay(retryPolicy.maxDelay, monoidRetryPolicy.concat(
      exponentialBackoff(250),
      limitRetries(retryPolicy.maxRetries),
    )),
    status => pipe(
      logRetry(service.name, method.name, status),
      beforeRetry(status, retryPolicy.willRetry),
      performRequest,
    ),
    shouldRetry(retryPolicy),
  )

  fetchWithRetry().then(fold(
    error => {
      callback(error)
      if (didGiveUp(error, retryPolicy)) {
        retryPolicy.onGiveUp()
      }
    },
    encodedResponse => {
      callback(null, encodedResponse)
    }
  ))
}

export default R.curry(createHttpExecutor)

export const emptyRequestConfig = (): RequestInit => ({})

