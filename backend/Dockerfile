# syntax=docker/dockerfile:1
# ============================================================================
# Jawdi backend (Spring Boot / Java 21) — production image.
# Build context = ./backend (the full Maven reactor: common-* + avicare-app).
# ============================================================================

# ---- Build stage: full reactor, tests skipped (CI runs them separately) ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY . .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests clean package && \
    cp avicare-app/target/avicare-app-*.jar /app.jar

# ---- Runtime stage: JRE only ----
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app app
# Agent OpenTelemetry : instrumente HTTP, JDBC et Redis sans une ligne de code applicatif ni
# une dépendance au pom. Inerte tant que TRACING_JAVA_OPTS ne le charge pas — l'image est donc
# identique, traçage activé ou non.
# Version épinglée : un agent qui change tout seul est un agent qu'on ne peut pas déboguer.
ARG OTEL_AGENT_VERSION=2.10.0
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar /opt/otel/opentelemetry-javaagent.jar
RUN chmod 644 /opt/otel/opentelemetry-javaagent.jar

COPY --from=build /app.jar app.jar
USER app
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseContainerSupport -Djava.security.egd=file:/dev/./urandom" \
    TRACING_JAVA_OPTS=""
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=6 \
  CMD curl -fsS http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1
# TRACING_JAVA_OPTS est une variable À PART, jamais fusionnée dans JAVA_OPTS : redéfinir
# JAVA_OPTS depuis le compose écraserait MaxRAMPercentage et UseContainerSupport, et la JVM
# cesserait de respecter la limite mémoire du conteneur. Vide par défaut = aucun agent.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS $TRACING_JAVA_OPTS -jar app.jar"]
