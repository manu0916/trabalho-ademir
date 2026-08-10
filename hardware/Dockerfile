FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw
RUN ./mvnw -q -DskipTests dependency:go-offline

COPY src src
ARG RENDER_GIT_COMMIT=local
# Make the application layer depend on the exact Render revision. This prevents
# a successful deploy card from pointing at a cached application JAR.
RUN echo "Building backend revision ${RENDER_GIT_COMMIT}" && ./mvnw -q -DskipTests package

FROM eclipse-temurin:25-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar
ARG RENDER_GIT_COMMIT=local
ENV RENDER_GIT_COMMIT=${RENDER_GIT_COMMIT}
LABEL org.opencontainers.image.revision=${RENDER_GIT_COMMIT}

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS:-} -jar /app/app.jar"]
