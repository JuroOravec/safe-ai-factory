FROM golang:1.26-alpine
RUN go install github.com/jstemmer/go-junit-report/v2@latest
WORKDIR /workspace
CMD ["/usr/local/bin/test.sh"]
