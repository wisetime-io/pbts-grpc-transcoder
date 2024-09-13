# Copyright (c) 2020 WiseTime. All rights reserved.

pbjs = ../../../node_modules/.bin/pbjs
pbts = ../../../node_modules/.bin/pbts

.PHONY: protobuf
protobuf:
	mkdir -p generated
	$(pbjs) -t json \
		-o generated/test-protobuf-descriptor.json \
		protobuf/aBitOfEverythingMessage.test.proto \
		protobuf/httpTranscoder.test.proto
	$(pbjs) -t static-module \
		-o generated/test-protobuf.js \
		protobuf/aBitOfEverythingMessage.test.proto \
		protobuf/httpTranscoder.test.proto
	$(pbts) -o generated/test-protobuf.d.ts generated/test-protobuf.js
