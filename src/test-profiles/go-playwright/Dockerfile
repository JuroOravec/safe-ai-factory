FROM golang:1.26
RUN go install github.com/jstemmer/go-junit-report/v2@latest
RUN go install github.com/playwright-community/playwright-go/cmd/playwright@latest
RUN playwright install --with-deps
WORKDIR /workspace
CMD ["/usr/local/bin/test.sh"]
