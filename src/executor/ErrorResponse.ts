// Copyright (c) 2020 WiseTime. All rights reserved.

/**
 * An Error that is raised as a result of a failed HTTP request.
 * The underlying HTTP Response is made available.
 */
export class ErrorResponse extends Error {
  readonly response: Response;

  constructor(response: Response, message?: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.response = response
  }
}
