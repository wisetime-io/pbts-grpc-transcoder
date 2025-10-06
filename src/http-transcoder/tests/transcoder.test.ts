// Copyright (c) 2020 WiseTime. All rights reserved.

import { getOrElse } from "fp-ts/lib/Either"
import * as Protobuf from "protobufjs/light"
import transcodeRequest from "../transcoder"
import { tests as TestApi } from "./generated/test-protobuf"
import { randomString } from "./lib/random"
import { ConvertibleToJson, HttpRequest } from "../index"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const descriptor = require("./generated/test-protobuf-descriptor.json")

// Setup test dependencies
const transcode = (methodName: string, requestMessage: ConvertibleToJson): HttpRequest => {
  const descriptorRoot = Protobuf.Root.fromJSON(descriptor)
  const bogusRequest = (): HttpRequest => ({
    urlEncodedPath: "",
    urlEncodedQueryString: "",
    method: "GET",
    body: undefined,
  })
  return getOrElse(bogusRequest)(
    transcodeRequest(descriptorRoot, TestApi.HttpTranscoderTestService.name, methodName, requestMessage)
  )
}

test("TestMultipleBindings - Transcoder should pick the main binding", () => {
  const substitution = "provided value"
  const requestMessage = TestApi.SimpleFieldMessage.create({ field: substitution })
  const httpRequest = transcode("TestPathVariable", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${encodeURIComponent(substitution)}/bar`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toBeUndefined()
})

test("TestPathVariable substitution", () => {
  const substitution = "provided value"
  const requestMessage = TestApi.SimpleFieldMessage.create({ field: substitution })
  const httpRequest = transcode("TestPathVariable", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${encodeURIComponent(substitution)}/bar`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toBeUndefined()
})

test("TestPathVariableWithStar substitution", () => {
  const substitution = "provided value"
  const requestMessage = TestApi.SimpleFieldMessage.create({ field: `foo/${substitution}/bar` })
  const httpRequest = transcode("TestPathVariableWithStar", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/foo/${encodeURIComponent(substitution)}/bar/baz`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toBeUndefined()
})

test("TestPathVariableStarEquivalent substitution", () => {
  const substitution = "provided value"
  const requestMessage = TestApi.SimpleFieldMessage.create({ field: substitution })
  const httpRequest = transcode("TestPathVariableStarEquivalent", requestMessage)

  expect(httpRequest.method).toEqual("DELETE")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${encodeURIComponent(substitution)}/bar`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toBeUndefined()
})

test("TestPathVariableWithDoubleStar substitution", () => {
  const substitution = "provided value"
  const requestMessage = TestApi.SimpleFieldMessage.create({ field: `foo/bar/baz/${substitution}` })
  const httpRequest = transcode("TestPathVariableWithDoubleStar", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/foo/bar/baz/${encodeURIComponent(substitution)}:verb`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toBeUndefined()
})

test("TestGetQueryParameters transcoding", () => {
  const fieldOne = randomString()
  const fieldTwo = randomString()
  const fieldThree = randomString()

  const requestMessage = TestApi.FlatMessage.create({
    fieldOne: fieldOne.unencoded,
    fieldTwo: fieldTwo.unencoded,
    fieldThree: fieldThree.unencoded,
  })

  const httpRequest = transcode("TestGetQueryParameters", requestMessage)
  const queryString = `?fieldTwo=${fieldTwo.percentEncoded}&fieldThree=${fieldThree.percentEncoded}`

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${fieldOne.percentEncoded}/bar`)
  expect(httpRequest.urlEncodedQueryString).toEqual(queryString)
  expect(httpRequest.body).toBeUndefined()
})

test("TestPostQueryParameters transcoding", () => {
  const fieldOne = randomString()
  const fieldTwo = randomString()
  const fieldThree = randomString()

  const requestMessage = TestApi.FlatMessage.create({
    fieldOne: fieldOne.unencoded,
    fieldTwo: fieldTwo.unencoded,
    fieldThree: fieldThree.unencoded,
  })

  const httpRequest = transcode("TestPostQueryParameters", requestMessage)
  const queryString = `?fieldTwo=${fieldTwo.percentEncoded}&fieldThree=${fieldThree.percentEncoded}`

  expect(httpRequest.method).toEqual("POST")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${fieldOne.percentEncoded}/bar`)
  expect(httpRequest.urlEncodedQueryString).toEqual(queryString)
  expect(httpRequest.body).toBeUndefined()
})

test("TestBodyFieldMapping transcoding", () => {
  const fieldTwo = randomString()
  const fieldThree = randomString()
  const requestMessage = TestApi.FlatMessage.create({
    fieldOne: randomString().unencoded,
    fieldTwo: fieldTwo.unencoded,
    fieldThree: fieldThree.unencoded,
  })
  const httpRequest = transcode("TestBodyFieldMapping", requestMessage)

  expect(httpRequest.method).toEqual("PATCH")
  expect(httpRequest.urlEncodedPath).toEqual("/v1/bar")
  expect(httpRequest.urlEncodedQueryString)
    .toEqual(`?fieldTwo=${fieldTwo.percentEncoded}&fieldThree=${fieldThree.percentEncoded}`)
  expect(httpRequest.body).toEqual(JSON.stringify({ fieldOne: requestMessage.fieldOne }))
})

test("TestBodyStarMapping transcoding", () => {
  const fieldOne = randomString()
  const requestMessage = TestApi.FlatMessage.create({
    fieldOne: fieldOne.unencoded,
    fieldTwo: randomString().unencoded,
    fieldThree: randomString().unencoded,
  })
  const httpRequest = transcode("TestBodyStarMapping", requestMessage)

  expect(httpRequest.method).toEqual("POST")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/bar/${fieldOne.percentEncoded}`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toEqual(JSON.stringify({
    fieldTwo: requestMessage.fieldTwo,
    fieldThree: requestMessage.fieldThree,
  }))
})

test("TestRepeatedQueryParameters transcoding", () => {
  const multiOne = randomString()
  const multiTwo = randomString()
  const multiThree = randomString()
  const requestMessage = TestApi.RepeatedFieldMessage.create({
    multi: [multiOne.unencoded, multiTwo.unencoded, multiThree.unencoded],
  })
  const httpRequest = transcode("TestRepeatedQueryParameters", requestMessage)

  expect(httpRequest.method).toEqual("PUT")
  expect(httpRequest.urlEncodedPath).toEqual("/v1/foo")
  expect(httpRequest.urlEncodedQueryString).toEqual(
    `?multi=${multiOne.percentEncoded}` +
    `&multi=${multiTwo.percentEncoded}` +
    `&multi=${multiThree.percentEncoded}`
  )
  expect(httpRequest.body).toBeUndefined()
})

test("TestNestedPathVariable transcoding", () => {
  const value = randomString()
  const requestMessage = TestApi.NestedFieldMessage.create({
    nested: {
      inner: {
        value: value.unencoded,
      }
    }
  })
  const httpRequest = transcode("TestNestedPathVariable", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/foo/${value.percentEncoded}`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toBeUndefined()
})

test("TestNestedFieldQueryParameters transcoding", () => {
  const value = randomString()
  const requestMessage = TestApi.NestedFieldMessage.create({
    nested: {
      inner: {
        value: value.unencoded,
      }
    }
  })
  const httpRequest = transcode("TestNestedFieldQueryParameters", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual("/v1/foo")
  expect(httpRequest.urlEncodedQueryString).toEqual(`?nested.inner.value=${value.percentEncoded}`)
  expect(httpRequest.body).toBeUndefined()
})

test("TestNestedFieldBody transcoding", () => {
  const value = randomString()
  const requestMessage = TestApi.NestedFieldMessage.create({
    nested: {
      inner: {
        value: value.unencoded,
      }
    }
  })
  const httpRequest = transcode("TestNestedFieldBody", requestMessage)

  expect(httpRequest.method).toEqual("POST")
  expect(httpRequest.urlEncodedPath).toEqual("/v1/foo")
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toEqual(JSON.stringify(requestMessage.toJSON()))
})

test("TestABitOfEverythingQueryParameters transcoding", () => {
  const fieldOne = randomString()
  const fieldTwo = randomString()
  const value = randomString()
  const multiOne = randomString()
  const multiTwo = randomString()

  const requestMessage = TestApi.ABitOfEverythingMessage.create({
    fieldOne: fieldOne.unencoded,
    fieldTwo: fieldTwo.unencoded,
    nested: {
      inner: {
        value: value.unencoded,
      }
    },
    nestedRepeating: {
      multi: [
        multiOne.unencoded,
        multiTwo.unencoded,
      ],
    },
  })
  const httpRequest = transcode("TestABitOfEverythingQueryParameters", requestMessage)

  expect(httpRequest.method).toEqual("GET")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${fieldOne.percentEncoded}/foo`)
  expect(httpRequest.urlEncodedQueryString).toEqual(
    `?fieldTwo=${fieldTwo.percentEncoded}` +
    `&nested.inner.value=${value.percentEncoded}` +
    `&nestedRepeating.multi=${multiOne.percentEncoded}` +
    `&nestedRepeating.multi=${multiTwo.percentEncoded}`
  )
  expect(httpRequest.body).toBeUndefined()
})

test("TestABitOfEverythingBody transcoding", () => {
  const fieldOne = randomString()
  const fieldTwo = randomString().unencoded
  const value = randomString()
  const multiOne = randomString().unencoded
  const multiTwo = randomString().unencoded
  const requestMessage = TestApi.ABitOfEverythingMessage.create({
    fieldOne: fieldOne.unencoded,
    fieldTwo: fieldTwo,
    nested: {
      inner: {
        value: value.unencoded,
      }
    },
    nestedRepeating: {
      multi: [
        multiOne,
        multiTwo,
      ],
    },
  })
  const httpRequest = transcode("TestABitOfEverythingBody", requestMessage)

  expect(httpRequest.method).toEqual("POST")
  expect(httpRequest.urlEncodedPath).toEqual(`/v1/${fieldOne.percentEncoded}/${value.percentEncoded}`)
  expect(httpRequest.urlEncodedQueryString).toBeUndefined()
  expect(httpRequest.body).toEqual(JSON.stringify({
    fieldTwo,
    nestedRepeating: {
      multi: [
        multiOne,
        multiTwo,
      ],
    },
  }))
})

