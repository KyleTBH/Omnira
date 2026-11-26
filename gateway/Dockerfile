FROM golang:1.24-alpine AS builder
WORKDIR /src
COPY gateway/go.mod gateway/main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /gateway .
FROM alpine:3.21
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 omnira
USER omnira
COPY --from=builder /gateway /gateway
EXPOSE 8080
ENTRYPOINT ["/gateway"]
