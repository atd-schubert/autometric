FROM node:alpine

MAINTAINER Arne Schubert

COPY autometric.tgz index.ts package.json tsconfig.json /opt/autometric-example/
WORKDIR /opt/autometric-example/

RUN npm install
