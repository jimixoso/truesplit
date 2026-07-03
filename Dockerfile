FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/truesplit ./cmd/api/main.go

FROM alpine:3
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /bin/truesplit .
COPY migrations/ ./migrations/
ENV MIGRATIONS_DIR=/app/migrations
EXPOSE 8080
CMD ["/app/truesplit"]
