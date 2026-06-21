#!/bin/bash

# Determine the type of build based on the first script argument
BUILD_TYPE=${1:-production}
IMAGE_NAME=${IMAGE_NAME:-jason301c/docklands}

BUILDER=$(docker buildx create --use)

if [ "$BUILD_TYPE" == "canary" ]; then
    TAG="canary"
    echo PUSHING CANARY
        docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "${IMAGE_NAME}:${TAG}" -f 'Dockerfile' --push .
else
    echo  "PUSHING PRODUCTION"
    VERSION=$(node -p "require('./package.json').version")
    docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "${IMAGE_NAME}:latest" -t "${IMAGE_NAME}:${VERSION}" -f 'Dockerfile' --push .
fi

docker buildx rm $BUILDER
