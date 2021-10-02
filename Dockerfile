#
# Copyright 2021 Splunk Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

ARG BASE_IMAGE=node:10
FROM ${BASE_IMAGE}

#--------------------------------------
# INSTALL DOCKER
#--------------------------------------
RUN apt-get update && \
    apt-get -y install apt-transport-https \
    ca-certificates \
    curl \
    gnupg2 \
    software-properties-common && \
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg > /tmp/dkey; apt-key add /tmp/dkey && \
    add-apt-repository \
    "deb [arch=amd64] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") \
    $(lsb_release -cs) \
    stable" && \
    apt-get update && \
    apt-get -y install docker-ce

#--------------------------------------
# INSTALL LDAP-UTIL FOR AUTH
#--------------------------------------
RUN apt-get update && \
    apt-get -y install ldap-utils

#--------------------------------------
# INSTALL NPM DEPENDENCIES
#--------------------------------------
COPY *.json /app/
RUN cd /app && npm install

#--------------------------------------
# COPY FRONT-END SOURCE CODE
#--------------------------------------
COPY src/public_src /app/src/public_src
COPY webpack.config.js /app/
COPY .babelrc /app/

#--------------------------------------
# BUILD BUNDLE
#--------------------------------------
RUN cd /app && npm run build 

#--------------------------------------
# COPY BACK-END SOURCE CODE
#--------------------------------------
ARG EXTRA_FILES=files
COPY src /app/src
COPY test /app/test
COPY ${EXTRA_FILES} /app/files

#--------------------------------------
# DEFINE ENVIORNMENT VARIABLES
#--------------------------------------
ENV CONFIG_DIR=/app/files/configs

#--------------------------------------
# START APP
#--------------------------------------
EXPOSE 80
EXPOSE 443
ENTRYPOINT ["node", "/app/src/app.js"]