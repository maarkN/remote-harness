# Connection relay: one static binary on a distroless base, as a non-root user.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /relay . && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /healthcheck ./internal/healthcheck

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /relay /healthcheck /
ENV RELAY_ADDR=:8080
EXPOSE 8080
USER nonroot:nonroot
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["/healthcheck"]
ENTRYPOINT ["/relay"]
