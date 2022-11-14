// Copyright (c) 2020 WiseTime. All rights reserved.

import {
  doubleStarPathExpansionToRegex, fieldPaths,
  messageKeyPath,
  removeProperty,
  starPathExpansionToRegex,
} from "./util"

test("messageKeyPath is empty", () => {
  expect(messageKeyPath(undefined)).toEqual([])
  expect(messageKeyPath("")).toEqual([])
})

test("messageKeyPath translates string to array", () => {
  expect(messageKeyPath("field_one.field_two")).toEqual(["fieldOne", "fieldTwo"])
})

test("fieldPaths returns all object field paths", () => {
  const object = {
    foo: {
      fooBar: ""
    },
    baz: "",
  }
  expect(fieldPaths(object)).toEqual(["foo.foo_bar", "baz"])
})

test("removeProperty removes a property", () => {
  const before = {
    foo: {
      bar: "bar",
      baz: "baz",
    }
  }
  const after = {
    foo: {
      baz: "baz",
    }
  }
  expect(removeProperty(["foo", "bar"], before)).toEqual(after)
})

test("removeProperty removes dangling empty objects", () => {
  const before = {
    foo: "foo",
    bar: {
      baz: "baz"
    },
  }
  const after = {
    foo: "foo",
  }
  expect(removeProperty(["bar", "baz"], before)).toEqual(after)
})

test("removeProperty may empty object", () => {
  const before = {
    foo: {
      bar: {
        baz: "baz"
      }
    }
  }
  const after = {}
  expect(removeProperty(["foo", "bar", "baz"], before)).toEqual(after)
})

test("starPathExpansionToRegex match", () => {
  const path = "/foo/*/bar"
  const result = "/foo/123/bar".match(starPathExpansionToRegex(path))
  expect(result?.toString()).toEqual(["/foo/123/bar", "123"].toString())
})

test("starPathExpansionToRegex no match", () => {
  const path = "/foo/*/bar"
  const result = "/foo/123/abc/bar".match(starPathExpansionToRegex(path))
  expect(result).toBeNull()
})

test("doubleStarPathExpansionToRegex match", () => {
  const path = "/foo/**"
  const result = "/foo/bar/baz/123".match(doubleStarPathExpansionToRegex(path))
  expect(result?.toString()).toEqual(["/foo/bar/baz/123", "bar/baz/123"].toString())
})

test("doubleStarPathExpansionToRegex no match", () => {
  const path = "/foo/**"
  const result = "/bar/123".match(doubleStarPathExpansionToRegex(path))
  expect(result).toBeNull()
})
