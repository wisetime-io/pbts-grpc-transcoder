// Copyright (c) 2020 WiseTime. All rights reserved.

import { tests as Api } from "../http-transcoder/tests/generated/test-protobuf"
import createHttpExecutor, { emptyRequestConfig, Fetch } from "./executor"
import { ConvertibleToJson } from "../http-transcoder"
import { ErrorResponse } from "./ErrorResponse"
import { responseNotOk, never, RetryPolicy } from "./retry"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Response } = require("node-fetch")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const descriptor = require("../http-transcoder/tests/generated/test-protobuf-descriptor.json")

// Utils:

const createTestService = (fetch: Fetch, retryPolicy: RetryPolicy = never): Api.HttpTranscoderTestService => {
  const rpcExecutor = createHttpExecutor(
    fetch, retryPolicy, "http://unused", descriptor, emptyRequestConfig, Api.HttpTranscoderTestService
  )
  return Api.HttpTranscoderTestService.create(rpcExecutor)
}

const successResponse = (message: ConvertibleToJson): Response =>
  new Response(
    JSON.stringify(message.toJSON()),
    { status: 200 }
  )

const mockSuccessfulFetch = (message: ConvertibleToJson) => (_url: RequestInfo, _init?: RequestInit): Promise<Response> =>
  Promise.resolve(successResponse(message))

const mockFailedFetch = (error: Error) => (_url: RequestInfo, _init?: RequestInit): Promise<Response> =>
  Promise.reject(error)

const mockFetchWithResponse = (response: Response) => (_url: RequestInfo, _init?: RequestInit): Promise<Response> =>
  Promise.resolve(response)


// Tests:

test("httpExecutor fetch succeeds", () => {
  const message = Api.ABitOfEverythingMessage.create({
    fieldOne: "fieldOne",
    fieldTwo: "fieldTwo",
    nested : {
      inner: {
        value: "value",
      }
    },
    nestedRepeating: {
      multi: [
        "multiOne",
        "multiTwo",
      ],
    },
  })
  // Echo back the request message.
  const fetch = mockSuccessfulFetch(message)

  return createTestService(fetch)
    .testABitOfEverythingBody(message)
    .then(response => expect(response).toEqual(message))
})

test("httpExecutor fetch fails with generic error", () => {
  const message = Api.SimpleFieldMessage.create()
  const fetchError = new Error("Fetch error")
  const fetch = mockFailedFetch(fetchError)

  return createTestService(fetch)
    .testPathVariable(message)
    .catch(error => expect(error).toEqual(fetchError))
})

test("httpExecutor fetch fails because HTTP response status code is not 200", () => {
  const message = Api.SimpleFieldMessage.create()
  const response = new Response(
    undefined,
    { status: 500 }
  )

  return createTestService(mockFetchWithResponse(response))
    .testPathVariable(message)
    .catch(error =>
      // ErrorResponse wraps the HTTP Response so that RPC callers can inspect it.
      expect(error).toEqual(new ErrorResponse(response))
    )
})

test("httpExecutor fetch fails, is retried and succeeds", () => {
  const succeedOnAttemptNumber = 2

  let numAttempts = 0
  const mockRetriedFetch = () => (_url: RequestInfo, _init?: RequestInit): Promise<Response> => {
    numAttempts++
    if (numAttempts < succeedOnAttemptNumber) {
      return Promise.reject(new ErrorResponse(new Response()))
    }
    return Promise.resolve(successResponse(Api.Empty.create()))
  }

  let numWillRetryCalls = 0
  let didGiveUp = false
  const retryPolicy = responseNotOk(
    _ => true,
    succeedOnAttemptNumber,
    () => {
      numWillRetryCalls++
      return Promise.resolve()
    },
    () => didGiveUp = true
  )

  return createTestService(mockRetriedFetch(), retryPolicy)
    .testPathVariable(Api.SimpleFieldMessage.create())
    .then(response => {
      // Number of retries has not yet been exceeded when the call succeeds.
      expect(numAttempts).toEqual(succeedOnAttemptNumber)
      expect(response).toEqual(Api.Empty.create())
      expect(numWillRetryCalls).toEqual(succeedOnAttemptNumber - 1)
      expect(didGiveUp).toEqual(false)
    })
})

test("httpExecutor fetch fails, is retried until executor gives up", () => {
  const fetchError = new ErrorResponse(new Response())

  let willRetryCalled = false
  let didGiveUp = false
  const retryPolicy = responseNotOk(
    _ => true,
    2,
    () => {
      willRetryCalled = true
      return Promise.resolve()
    },
    () => didGiveUp = true
  )

  return createTestService(mockFailedFetch(fetchError), retryPolicy)
    .testPathVariable(Api.SimpleFieldMessage.create())
    .catch(error => {
      expect(error).toEqual(fetchError)
      expect(willRetryCalled).toEqual(true)
      expect(didGiveUp).toEqual(true)
    })
})

test("httpExecutor fetch fails, should not be retried and is not", () => {
  const fetchError = new ErrorResponse(new Response())

  let numAttempts = 0
  const mockAlwaysFailFetch = (error: Error) => (_url: RequestInfo, _init?: RequestInit): Promise<Response> => {
    numAttempts++
    return Promise.reject(error)
  }

  let willRetryCalled = false
  let didGiveUp = false
  const retryPolicy = responseNotOk(
    _ => false,
    2,
    () => {
      willRetryCalled = true
      return Promise.resolve()
    },
    () => didGiveUp = true
  )

  return createTestService(mockAlwaysFailFetch(fetchError), retryPolicy)
    .testPathVariable(Api.SimpleFieldMessage.create())
    .catch(error => {
      expect(error).toEqual(fetchError)
      // Only one attempt. No retry.
      expect(numAttempts).toEqual(1)
      // No retry.
      expect(willRetryCalled).toEqual(false)
      // Did not retry, therefore didn't give up.
      expect(didGiveUp).toEqual(false)
    })
})

test("httpExecutor willRetry failure prevents further retries", () => {
  const fetchError = new ErrorResponse(new Response())

  let numAttempts = 0
  const mockRetriedFetch = () => (_url: RequestInfo, _init?: RequestInit): Promise<Response> => {
    numAttempts++
    return Promise.reject(new ErrorResponse(new Response()))
  }

  const willRetry = () => Promise.reject(fetchError)

  let didGiveUp = false
  const retryPolicy = responseNotOk(
    _ => true,
    2,
    willRetry,
    () => didGiveUp = true
  )

  return createTestService(mockRetriedFetch(), retryPolicy)
    .testPathVariable(Api.SimpleFieldMessage.create())
    .catch(_ => {
      // willRetry failed. Therefore the call was not retried.
      expect(numAttempts).toEqual(1)
      // We did not exhaust number of attempts.
      expect(didGiveUp).toEqual(false)
    })
})

