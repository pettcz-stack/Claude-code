FROM eclipse-temurin:17-jre

ARG DAVMAIL_VERSION=6.2.2

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates unzip \
 && rm -rf /var/lib/apt/lists/*

# Stáhne oficiální davmail zip z SourceForge a rozbalí ho do /opt/davmail.
# find má zaručit, že najdeme správný adresář bez ohledu na to, jestli
# má root prefix s verzí nebo ne.
RUN set -eux; \
    curl -fSL "https://downloads.sourceforge.net/project/davmail/davmail/${DAVMAIL_VERSION}/davmail-${DAVMAIL_VERSION}.zip" \
         -o /tmp/davmail.zip; \
    mkdir -p /tmp/extract; \
    unzip -q /tmp/davmail.zip -d /tmp/extract; \
    SRC="$(find /tmp/extract -maxdepth 3 -name davmail.jar -printf '%h\n' | head -n 1)"; \
    test -n "$SRC"; \
    mv "$SRC" /opt/davmail; \
    rm -rf /tmp/davmail.zip /tmp/extract; \
    ls -la /opt/davmail

RUN useradd -m -u 1000 davmail \
 && mkdir -p /home/davmail/.davmail \
 && chown -R davmail:davmail /home/davmail

USER davmail
WORKDIR /home/davmail

EXPOSE 1143 1025

ENTRYPOINT ["java", "-cp", "/opt/davmail/davmail.jar:/opt/davmail/lib/*", "davmail.DavGateway"]
CMD ["/etc/davmail.properties"]
