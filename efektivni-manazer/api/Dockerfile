FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Nejdřív zkopíruj všechno – jednodušší a pro MVP rychlost vývoje vs. cache neřešíme
COPY . ./

RUN pip install --upgrade pip && pip install .

EXPOSE 8000
