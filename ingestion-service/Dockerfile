# Build stage
FROM golang:1.21-alpine AS builder

# Install git for go mod download
RUN apk add --no-cache git

WORKDIR /app

# Copy go mod files
COPY go.mod ./

# Copy source code first
COPY . .

# Download dependencies and build
RUN go mod download
RUN go get github.com/ClickHouse/clickhouse-go/v2@v2.15.0
RUN go get github.com/Shopify/sarama@v1.38.1
RUN go get github.com/prometheus/client_golang@v1.17.0
RUN go get go.opentelemetry.io/proto/otlp@v1.0.0
RUN go get google.golang.org/protobuf@v1.31.0
RUN go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo -o ingestion-service .

# Final stage
FROM alpine:latest

# Install ca-certificates for SSL connections
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/ingestion-service .

# Expose metrics port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the service
CMD ["./ingestion-service"]