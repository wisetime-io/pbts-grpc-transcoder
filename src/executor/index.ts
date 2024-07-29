// Copyright (c) 2020 WiseTime. All rights reserved.
//
// This is the API for the grpc/executor module.
// The module allows calling RPCs via HTTP/1 and JSON.

import { enableAllPlugins } from "immer"

// Required for IE11 support https://immerjs.github.io/immer/docs/installation#pick-your-immer-version
enableAllPlugins()

export { default, emptyRequestConfig } from "./executor"
export * from "./retry"
