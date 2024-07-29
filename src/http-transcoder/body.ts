// Copyright (c) 2020 WiseTime. All rights reserved.

import produce from "immer"
import { TranscodingBundle } from "./transcoder"
import { removeProperty, snakeToCamelcase } from "./util"

/**
 * Transcode the HTTP body that should be used for the gRPC call.
 *
 * @param bundle - The transcoding bundle to process and augment with the HTTP body.
 */
const transcodeBody = (bundle: TranscodingBundle): TranscodingBundle => {
  switch (bundle.config.body) {
    case undefined:
      // Empty.
      return produce(bundle, b => {
        b.transcoded.body = undefined
      })

    case "*":
      // All remaining fields.
      return produce(bundle, b => {
        b.transcoded.body = JSON.stringify(bundle.notTranscoded)
        b.notTranscoded = {}
      })

    default:
      // Single field.
      // The field must be present at the top-level of the request message type.
      const key = snakeToCamelcase(bundle.config.body!)
      const value = bundle.notTranscoded[key]
      return produce(bundle, b => {
        b.transcoded.body = JSON.stringify({ [key]: value })
        b.notTranscoded = removeProperty([key], b.notTranscoded)
      })
  }
}

export default transcodeBody
