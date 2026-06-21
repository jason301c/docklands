#!/bin/bash

# Determine the type of build based on the first script argument
BUILD_TYPE=${1:-production}
IMAGE_NAME=${IMAGE_NAME:-jason301c/docklands}

if [ "$BUILD_TYPE" == "canary" ]; then
    TAG="canary"
else
    VERSION=$(node -p "require('./package.json').version")
    TAG="$VERSION"
fi

BUILDER=$(docker buildx create --use)

docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "${IMAGE_NAME}:${TAG}" -f 'Dockerfile' .

docker buildx rm $BUILDER
