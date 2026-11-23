FROM alpine:3.24.3
RUN apk add --no-cache age=1.3.2-r1
ENTRYPOINT ["age"]
