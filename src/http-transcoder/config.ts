// Copyright (c) 2020 WiseTime. All rights reserved.

import { Either, left, right, map, chain, fromNullable } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/pipeable"
import { Root } from "protobufjs/light"
import { HttpMethod } from "./"
import produce from "immer"

export type TranscodingConfig = {
  pathTemplate: string,
  method: HttpMethod,
  body?: string,
}

type RpcOptions = Record<string, string>

type ParsingBundle = {
  options: RpcOptions,
  httpOptionKeyWithPath?: string,
  pathTemplate?: string,
  method?: HttpMethod,
  body?: string,
}

export enum RpcHttpOptionKey {
  GET = "(google.api.http).get",
  PUT = "(google.api.http).put",
  POST = "(google.api.http).post",
  DELETE = "(google.api.http).delete",
  PATCH = "(google.api.http).patch",
  BODY = "(google.api.http).body",
}

const readRpcOptions = (descriptorRoot: Root, serviceName: string, methodName: string):
  Either<Error, ParsingBundle> =>
{
  const rpcOptions = descriptorRoot.lookupService(serviceName).methods[methodName].options
  return pipe(
    fromNullable(new Error(`RPC ${methodName} does not have any configured HTTP options.`))(rpcOptions),
    map(rpcOptions => ({ options: rpcOptions })),
  )
}

const httpOptionWithPathNotFound = new Error("RPC does not have an HTTP option with a path template.")

const onlyHttpOptions = (rpcOptions: RpcOptions): RpcOptions => {
  const isHttpOption = (optionKey: string): boolean =>
    undefined !== Object.values(RpcHttpOptionKey).find(k => k === optionKey)

  return produce(rpcOptions, options => {
    Object.keys(options).forEach(key => {
      if (!isHttpOption(key)) {
        delete options[key]
      }
    })
  })
}

const findHttpOptionKeyWithPath = (bundle: ParsingBundle): ParsingBundle => {
  const onlyHttp = onlyHttpOptions(bundle.options)
  const withPath = produce(onlyHttp, options => { delete options[RpcHttpOptionKey.BODY] })
  const keys = Object.keys(withPath)
  const firstKeyWithPath = keys.length == 0 ? undefined : keys[0]
  return produce(bundle, b => { b.httpOptionKeyWithPath = firstKeyWithPath })
}

const addPathTemplate = (bundle: ParsingBundle): Either<Error, ParsingBundle> =>
  pipe(
    fromNullable(httpOptionWithPathNotFound)(bundle.httpOptionKeyWithPath),
    map(optionKey => produce(bundle, b => {
      b.pathTemplate = bundle.options[optionKey]
    }))
  )

const parseMethod = (optionKey: string): HttpMethod | undefined => {
  switch (optionKey) {
    case RpcHttpOptionKey.GET:
      return "GET"
    case RpcHttpOptionKey.PUT:
      return "PUT"
    case RpcHttpOptionKey.POST:
      return "POST"
    case RpcHttpOptionKey.DELETE:
      return "DELETE"
    case RpcHttpOptionKey.PATCH:
      return "PATCH"
    default:
      return undefined
  }
}

const addMethod = (bundle: ParsingBundle): Either<Error, ParsingBundle> =>
  pipe(
    fromNullable(httpOptionWithPathNotFound)(bundle.httpOptionKeyWithPath),
    map(optionKey => produce(bundle, b => {
      b.method = parseMethod(optionKey)
    }))
  )

const addBody = (bundle: ParsingBundle): ParsingBundle =>
  produce(bundle, b => {
    b.body = bundle.options[RpcHttpOptionKey.BODY]
  })

const getConfig = (bundle: ParsingBundle): Either<Error, TranscodingConfig> => {
  if (bundle.pathTemplate === undefined) {
    return left(new Error("Could not parse path template"))
  }
  if (bundle.method === undefined) {
    return left(new Error("Could not parse HTTP method"))
  }
  return right({
    pathTemplate: bundle.pathTemplate!,
    method: bundle.method!,
    body: bundle.body,
  })
}

/**
 * Reads the transcoding configuration for an RPC call from a protobuf descriptor.
 * The configuration describes how gRPC to HTTP/1 & JSON transcoding should be done.
 *
 * @param descriptorRoot - Root of the protobuf descriptor that contains the transcoding configuration
 * @param serviceName - The name of the service that contains the RPC to be transcoded
 * @param methodName - The RPC whose transcoding configuration is being read
 */
const readConfiguration = (
  descriptorRoot: Root,
  serviceName: string,
  methodName: string
): Either<Error, TranscodingConfig> =>
  pipe(
    readRpcOptions(descriptorRoot, serviceName, methodName),
    map(findHttpOptionKeyWithPath),
    chain(addPathTemplate),
    chain(addMethod),
    map(addBody),
    chain(getConfig),
  )

export default readConfiguration
