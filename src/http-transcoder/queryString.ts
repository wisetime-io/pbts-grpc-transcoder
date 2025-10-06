// Copyright (c) 2020 WiseTime. All rights reserved.

import * as R from "ramda"
import produce from "immer"
import { TranscodingBundle } from "./transcoder"
import { fieldPaths, messageKeyPath, snakeToCamelcase } from "./util"

type Field = {
  fieldPath: string,  // E.g. "foo_bar.baz"
  value: any,
}

const renderField = (field: Field): string => {
  if (Array.isArray(field.value)) {
    return field.value
      .map(value => `${snakeToCamelcase(field.fieldPath)}=${encodeURIComponent(value)}`)
      .join("&")
  }
  return `${snakeToCamelcase(field.fieldPath)}=${encodeURIComponent(field.value)}`
}

const transcodeQueryString = (bundle: TranscodingBundle): TranscodingBundle => {
  if (bundle.config.body === "*") {
    return bundle
  }
  const queryString: string = fieldPaths(bundle.notTranscoded)
    .map(fieldPath => ({
      fieldPath,
      value: R.path(messageKeyPath(fieldPath))(bundle.notTranscoded),
    }))
    .filter(field => !R.isEmpty(field.value))
    .map(renderField)
    .join("&")
    .replace(/^/,"?")

  return produce(bundle, b => {
    b.transcoded.urlEncodedQueryString = queryString == "?" ? undefined : queryString
    b.notTranscoded = {}
  })
}

export default transcodeQueryString
