# pbts-grpc-transcoder

pbts-grpc-transcoder is a [TypeScript](https://www.typescriptlang.org) library that provides [gRPC](https://grpc.io) to HTTP/1 & JSON transcoding for the [protobuf.js library](https://github.com/protobufjs/protobuf.js).

The library is published via [npm](https://www.npmjs.com/package/@wisetime/pbts-grpc-transcoder). Get it via:

```text
npm i @wisetime/pbts-grpc-transcoder
```

## Transcoding

gRPC uses HTTP/2 as its transfer protocol and typically sends messages as binary payloads. However, when we define a gRPC service, we can optionally specify [HTTP Options](https://github.com/googleapis/googleapis/blob/master/google/api/http.proto) for the RPCs, so that REST clients can interact with our service using HTTP/1 and JSON.

We can implement our service as usual in gRPC, and then pass client requests through a transcoding proxy to our service. The following applications can transcode HTTP/1 + JSON to gRPC:

* [Envoy proxy](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/grpc_json_transcoder_filter)
* [grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway)
* [ESP](https://github.com/cloudendpoints/esp) for Google Cloud Endpoints

Transcoding is useful if the client does not support gRPC and is not able to use [gRPC-Web](https://github.com/grpc/grpc-web).

### Example Service

Let's look at an example Todo service, defined using [Protocol Buffers](https://developers.google.com/protocol-buffers/docs/proto3) as:

```protobuf
package todo;

service TodoService {
  rpc CreateTodo(CreateTodoRequest) returns (Todo);
  rpc DeleteTodo(DeleteTodoRequest) returns (google.protobuf.Empty);
}

message CreateTodoRequest {
  string title = 1;
}

message Todo {
  string id = 1;
  string title = 2;
  bool completed = 3;
}

message DeleteTodoRequest {
  string id = 1;
}
```

If we define the following HTTP options for the RPCs:

```protobuf
service TodoService {
  rpc CreateTodo(CreateTodoRequest) returns (Todo) {
    option (google.api.http) = {
      post: "/v1/todos"
      body: "*"
    };
  }
  rpc DeleteTodo(DeleteTodoRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v1/todos/{id}"
    };
  }
}
```

We can then create a new Todo item by making a `POST` HTTP request to `/v1/todos` with the following JSON payload:

```json
{
  "title": "Book flight to Mauritius"
}
```

We can delete a Todo item by making a HTTP request such as:

```text
DELETE /v1/todos/123
```

## Reverse Transcoding

That's great, we can now communicate with a gRPC service through plain HTTP/1 and JSON. However, we have lost our strongly typed calls and messages and are now dealing with ad hoc HTTP requests and hand-crafted JSON.

What if we could still make fully-typed RPC calls to the server while still going over HTTP/1 with JSON payloads? We would like to use [protobuf.js with TypeScript](https://github.com/protobufjs/protobuf.js#pbts-for-typescript) to call our service like this:

```typescript
todoService
  .createTodo(CreateTodoRequest.create({
    title: "Book flight to Mauritius"  // Type-checked by TypeScript.
  }))
  .then(response => {
    console.log(`id: ${response.id}`)
    console.log(`title: ${response.title}`)
    console.log(`completed: ${response.completed}`)
  })
```

This is what pbts-grpc-transcoder allows us to do. We call our service as if we were making a normal gRPC call using protobuf.js. pbts-grpc-transcoder transcodes the call to HTTP/1 and JSON using the HTTP options specified for the RPC. The proxy receives the HTTP/1 and JSON request and transcodes that to a gRPC call to the underlying service.

## Setup

Install pbts-grpc-transcoder via npm:

```text
npm i @wisetime/pbts-grpc-transcoder
```

protobuf.js will be installed as a dependency and the pbjs and pbts utilities will be available in your `node_modules/.bin` directory.

Generate the JSON protobuf descriptor. This will be used by the transcoder. For example:

```text
node_modules/.bin/pbjs -t json \
  -o src/generated/protobuf-descriptor.json \
  src/protobuf/todo.proto \
```

Next, generate the JavaScript client library as a static module that you can import:

```text
node_modules/.bin/pbjs -t static-module \
  -o src/generated/protobuf.js \
  src/protobuf/todo.proto \
```

Finally, generate the TypeScript types:

```text
node_modules/.bin/pbts \
  -o src/generated/protobuf.d.ts \
  src/generated/protobuf.js
```

## Usage

pbts-grpc-transcoder provides a HTTP executor for protobuf.js. The executor supports automatic call retries via a `RetryPolicy`. Here's an example showing how to create an executor and provide it to protobuf.js.

```typescript
import { todo as TodoApi } from "generated/protobuf"
const descriptor = require("generated/protobuf-descriptor.json")

// Request decorator to add the user's ID token for authentication.
const configureRequest = (): RequestInit => ({
  headers: {
    "Authorization": "Bearer ID_TOKEN_HERE",
  },
})

const willRetry = () => {
  // Here we could attempt to exchange user's refresh token for an ID token...
  // Call will be retried when the promise resolves.
  return Promise.resolve()
}

const onGiveUp = () => {
  // For example, force user logout...
}

// Set up a retry policy that will cause the RPC executor to automatically
// retry calls if they fail with status 401 Unauthorized. The executor will
// run willRetry() before retrying the call. It will retry up to 2 times with
// exponential backoff. If the call still fails after 2 retries, the executor
// calls the onGiveUp() callback.
const retryPolicy = responseNotOk(
  (response: Response) => response.status === 401,
  2,
  willRetry,
  onGiveUp,
)

// Create the RPC executor. The createHttpExecutor function is auto-curried.
// You can preconfigure various versions as needed.
const executor = createHttpExecutor(
  window.fetch, retryPolicy, "http://localhost", descriptor, configureRequest
)

const todoService = ReportApi.ReportService.create(
  executor(TodoApi.TodoService)
)

// An RPC message is type checked.
const deleteRequest = TodoApi.DeleteTodoRequest.create({ id: "123" })

// Call the service.
todoService
  .deleteTodo(deleteRequest)
  .then(response => {
    // ...
  })
```
