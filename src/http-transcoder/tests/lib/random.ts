// Copyright (c) 2020 WiseTime. All rights reserved.

import * as fakerUtf8 from "@faker-js/faker/locale/zh_CN"

type RandomString = {
  unencoded: string,
  percentEncoded: string,
}

export const randomString = (): RandomString => {
  const unencoded = fakerUtf8.random.words()
  return {
    unencoded,
    percentEncoded: encodeURIComponent(unencoded),
  }
}

