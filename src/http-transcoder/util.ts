// Copyright (c) 2020 WiseTime. All rights reserved.

import { Json } from "./index"
import * as R from "ramda"

export const snakeToCamelcase = (s: string): string => s.replace(
  /([-_][a-z])/g,
  (group) => group.toUpperCase()
    .replace("-", "")
    .replace("_", "")
)

export const camelToSnakecase = (s: string): string => s.replace(
  /[A-Z]/g,
  letter => `_${letter.toLowerCase()}`
)

// Convert protobuf field paths into equivalent JSON message key path.
// E.g. "foo_field.bar_field.baz_field" becomes ["fooField", "barField", "bazField"].
export const messageKeyPath = (fieldPath: string | undefined): string[] => {
  if (fieldPath === undefined || fieldPath === "") {
    return []
  }
  return snakeToCamelcase(fieldPath).split(".")
}

// Get the field paths for all object properties.
// A field path is in this format: "field.sub_field"
export const fieldPaths = (object: Json): string[] => {
  const isObject = (value: any) =>
    typeof value === "object" && !Array.isArray(value)

  const addDelimiter = (a: string, b: string) => a ? `${a}.${b}` : b

  const paths = (object: Json = {}, head = ""): string[] =>
    Object
      .entries(object)
      .reduce((acc: string[], [key, value]) => {
        const path = addDelimiter(head, key)
        return isObject(value)
          ? acc.concat(paths(value, path))
          : acc.concat(path)
      }, [])
      .map(camelToSnakecase)

  return paths(object)
}

export const removeProperty = (keyPath: string[], object: Json): Json => {
  const withoutProperty = R.dissocPath<Json>(keyPath, object)
  const parentKeyPath = R.dropLast<string>(1)(keyPath)
  const parentValue = R.path(parentKeyPath)(withoutProperty)
  if (parentKeyPath.length > 0 && R.isEmpty(parentValue)) {
    return removeProperty(parentKeyPath, withoutProperty)
  }
  return withoutProperty
}

export const starPathExpansionToRegex = (path: string): RegExp => {
  const expression = path.replace("*", "([^/]*)")
  return new RegExp(expression)
}

export const doubleStarPathExpansionToRegex = (path: string): RegExp => {
  const expression = path.replace("**", "(.*)")
  return new RegExp(expression)
}

