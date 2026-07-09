# syntax=docker/dockerfile:1
# ============================================================================
# AviCare backend (Spring Boot / Java 21) — production image.
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
COPY --from=build /app.jar app.jar
USER app
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseContainerSupport -Djava.security.egd=file:/dev/./urandom"
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=6 \
  CMD curl -fsS http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
