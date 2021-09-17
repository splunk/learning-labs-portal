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