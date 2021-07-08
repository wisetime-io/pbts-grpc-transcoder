// Copyright (c) 2020 WiseTime. All rights reserved.

import * as R from "ramda"
import produce from "immer"
import { Either, right, map } from "fp-ts/lib/Either"
import { reduce } from "fp-ts/lib/Array"
import { pipe } from "fp-ts/lib/pipeable"
import { TranscodingBundle } from "./transcoder"
import { doubleStarPathExpansionToRegex, messageKeyPath, removeProperty, starPathExpansionToRegex } from "./util"
import { Json } from "./index"

type PathSubstitution = {
  variable: string,
  messageKeyPath: string[],
  value?: string,
}

type PathTranscodingBundle = {
  pathSubstitutions: Array<PathSubstitution>,
  transcodingBundle: TranscodingBundle,
}

const createPathTranscodingBundle = (transcodingBundle: TranscodingBundle): Either<Error, PathTranscodingBundle> =>
  right({
    pathSubstitutions: [],
    transcodingBundle,
  })

const parsePathSubstitutions = (bundle: PathTranscodingBundle): PathTranscodingBundle => {
  const createPathSubstitution = (variable: string): PathSubstitution => ({
    variable,
    messageKeyPath: [],
  })
  const addMessageKeyPath = (pathSubstitution: PathSubstitution): PathSubstitution => {
    const fieldPath = pathSubstitution.variable.slice(1, -1).split("=")[0]
    return {
      ...pathSubstitution,
      messageKeyPath: messageKeyPath(fieldPath),
    }
  }
  const addValue = (jsonMessage: object) => (pathSubstitution: PathSubstitution): PathSubstitution => ({
    ...pathSubstitution,
    value: R.path(pathSubstitution.messageKeyPath, jsonMessage),
  })
  const { pathTemplate } = bundle.transcodingBundle.config
  const message = bundle.transcodingBundle.notTranscoded
  const substitutionsRegex = /{(.[^{}]*)}/g

  const pathSubstitutions = pathTemplate
    .match(substitutionsRegex)
    ?.map(createPathSubstitution)
    .map(addMessageKeyPath)
    .map(addValue(message)) ?? []

  return produce(bundle, b => {
    b.pathSubstitutions = pathSubstitutions
  })
}

/**
 * Best effort. If the protobuf HTTP option does not conform to spec and we cannot
 * render the variable, return the path template unchanged so that developers can
 * see where the issue is.
 */
const renderVariable = (pathTemplate: string, variable: string, value: any): string => {
  // From spec: The path variables must not refer to any repeated or mapped field.
  if (typeof value === "object" && !Array.isArray(value)) {
    return pathTemplate
  }

  const variableParts = variable.slice(1, -1).split("=")

  if (variableParts.length === 1 || variableParts[1] === "*") {
    // From spec: If a variable contains exactly one path segment, such as `"{var}"`
    // or `"{var=*}"`, when such a variable is expanded into a URL path on the client
    // side, all characters except `[-_.~0-9a-zA-Z]` are percent-encoded.
    return pathTemplate.replace(variable, encodeURIComponent(value ?? ""))
  }

  // From spec: If a variable contains multiple path segments, such as `"{var=foo/*}"`
  // or `"{var=**}"`, when such a variable is expanded into a URL path on the client
  // side, all characters except `[-_.~/0-9a-zA-Z]` are percent-encoded.

  const expansionExpression = variableParts[1]
  let matched: RegExpMatchArray | null = null
  if (expansionExpression.includes("*")) {
    matched = value.match(starPathExpansionToRegex(expansionExpression))
  }
  if (expansionExpression.includes("**")) {
    matched = value.match(doubleStarPathExpansionToRegex(expansionExpression))
  }
  if (matched !== null) {
    const substitution = matched[0].split("/").map(encodeURIComponent).join("/")
    return pathTemplate.replace(variable, substitution)
  }

  // We can't render this variable.
  return pathTemplate
}

const substituteFieldValues = (bundle: PathTranscodingBundle): PathTranscodingBundle => {
  const transcodePath: (pss: PathSubstitution[]) => string = reduce(
    bundle.transcodingBundle.config.pathTemplate,
    (acc, ps) => renderVariable(acc, ps.variable, ps.value)
  )
  const transcodedPath = transcodePath(bundle.pathSubstitutions)
  return produce(bundle, b => { b.transcodingBundle.transcoded.urlEncodedPath = transcodedPath })
}

const updateNotTranscoded = (bundle: PathTranscodingBundle): PathTranscodingBundle => {
  const removeTranscoded: (pss: PathSubstitution[]) => Json = reduce(
    bundle.transcodingBundle.notTranscoded,
    (acc, ps) => removeProperty(ps.messageKeyPath, acc)
  )
  const withoutSubstitutions = removeTranscoded(bundle.pathSubstitutions)
  return produce(bundle, b => { b.transcodingBundle.notTranscoded = withoutSubstitutions })
}

/**
 * Transcode the HTTP path that should be used for the gRPC call.
 *
 * @param bundle - The transcoding bundle to process and augment with the HTTP path.
 */
const transcodePath = (bundle: TranscodingBundle): Either<Error, TranscodingBundle> =>
  pipe(
    createPathTranscodingBundle(bundle),
    map(parsePathSubstitutions),
    map(substituteFieldValues),
    map(updateNotTranscoded),
    map(bundle => bundle.transcodingBundle),
  )

export default transcodePath

