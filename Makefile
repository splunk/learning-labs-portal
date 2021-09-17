# Environment variables used during build-time
BASE_IMAGE ?= node:10
EXTRA_FILES ?= files

# Environment variables used during run-time
IMAGE ?= localhost/doc-hub/service-all:local
DEPLOYMENT_ENV ?= local
RESTART_DOCS ?= no
DATASTORE ?= local
DATASTORE_URL ?= /mount/datastore
VOLUME ?= $(shell pwd)/mount/volume
BRIDGE ?= DocHubNetwork
CONTAINER_NAME = ws-svc

HEC_HOST ?= http://localhost:8088
HEC_SOURCE ?= Workshop-Local
HEC_INDEX ?= workshop
HEC_TOKEN ?= $(shell cat mount/hec_token)

all: build

docker-env:
	docker run --rm -it -v $(PWD):/workspace $(BASE_IMAGE) /bin/bash

build:
	docker build -t $(IMAGE) \
	--build-arg "BASE_IMAGE=$(BASE_IMAGE)" \
	--build-arg "EXTRA_FILES=$(EXTRA_FILES)" \
	.

create-network:
	-docker network create -d bridge $(BRIDGE)

push: build
	docker push $(IMAGE)

pull:
	docker pull $(IMAGE)

stop:
	-docker stop $(CONTAINER_NAME)
	-docker rm $(CONTAINER_NAME)

exec:
	docker run --rm -it --entrypoint /bin/bash $(IMAGE)

mount/jwt_secret:
	mkdir -p mount
	echo 'DEVELOPMENT SECRET' > mount/jwt_secret

run : build create-network mount/jwt_secret
	docker run --rm -it -p 3000:80 \
		--network $(BRIDGE) \
		--name $(CONTAINER_NAME) \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(shell pwd)/mount:/mount \
		-e "DEPLOYMENT_ENV=$(DEPLOYMENT_ENV)" \
		-e "RESTART_DOCS=$(RESTART_DOCS)" \
		-e "DATASTORE=$(DATASTORE)" \
		-e "DATASTORE_URL=$(DATASTORE_URL)" \
		-e "VOLUME=$(VOLUME)" \
		-e "BRIDGE=$(BRIDGE)" \
		$(IMAGE)

run-ssl : build create-network mount/jwt_secret
	docker run --rm -it -p 80:80 -p 443:443 \
		--network $(BRIDGE) \
		--name $(CONTAINER_NAME) \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(shell pwd)/mount:/mount \
		-v $(shell pwd)/test_cert:/cert \
		-e "DEPLOYMENT_ENV=$(DEPLOYMENT_ENV)-ssl" \
		-e "RESTART_DOCS=$(RESTART_DOCS)" \
		-e "DATASTORE=$(DATASTORE)" \
		-e "DATASTORE_URL=$(DATASTORE_URL)" \
		-e "VOLUME=$(VOLUME)" \
		-e "BRIDGE=$(BRIDGE)" \
		$(IMAGE)

run-vm : stop pull create-network
	docker run -d -p 80:80 -p 443:443 \
		--network $(BRIDGE) \
		--name $(CONTAINER_NAME) \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(shell pwd)/mount:/mount \
		-v $(shell pwd)/cert:/cert \
		-e "DEPLOYMENT_ENV=$(DEPLOYMENT_ENV)" \
		-e "RESTART_DOCS=$(RESTART_DOCS)" \
		-e "DATASTORE=$(DATASTORE)" \
		-e "DATASTORE_URL=$(DATASTORE_URL)" \
		-e "VOLUME=$(VOLUME)" \
		-e "BRIDGE=$(BRIDGE)" \
		-e "IGNORE_SSL_WARNING=yes" \
		--restart unless-stopped \
		--log-driver=splunk \
		--log-opt splunk-token=$(HEC_TOKEN) \
		--log-opt splunk-source=$(HEC_SOURCE) \
		--log-opt splunk-index=$(HEC_INDEX) \
		--log-opt splunk-url=$(HEC_HOST) \
		--log-opt splunk-format=json \
		--log-opt splunk-insecureskipverify=true \
		-e "LOG_DRIVER=splunk" \
		-e "LOG_SPLUNK_INDEX=$(HEC_INDEX)" \
		-e "LOG_SPLUNK_SOURCE=$(HEC_SOURCE)" \
		-e "LOG_SPLUNK_TOKEN=$(HEC_TOKEN)" \
		-e "LOG_SPLUNK_URL=$(HEC_HOST)" \
		$(IMAGE)