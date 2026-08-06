package com.ecommerce.hardware.auth;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginAttemptService {

    private static final int MAX_FAILURES = 5;
    private static final int MAX_TRACKED_KEYS = 10_000;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private final ConcurrentHashMap<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public LoginAttemptDecision check(String clientIp, String email) {
        Instant now = Instant.now();
        AttemptSnapshot ip = snapshot("ip:" + clientIp, now);
        AttemptSnapshot identity = snapshot("email:" + email, now);
        AttemptSnapshot strictest = ip.count() >= identity.count() ? ip : identity;

        if (strictest.count() >= MAX_FAILURES) {
            long seconds = Math.max(1, Duration.between(now, strictest.oldest().plus(WINDOW)).toSeconds());
            return LoginAttemptDecision.blockedDecision(seconds);
        }
        return LoginAttemptDecision.allowedDecision();
    }

    public LoginAttemptDecision recordFailure(String clientIp, String email) {
        Instant now = Instant.now();
        AttemptSnapshot ip = addFailure("ip:" + clientIp, now);
        AttemptSnapshot identity = addFailure("email:" + email, now);
        AttemptSnapshot strictest = ip.count() >= identity.count() ? ip : identity;

        if (strictest.count() >= MAX_FAILURES) {
            long seconds = Math.max(1, Duration.between(now, strictest.oldest().plus(WINDOW)).toSeconds());
            return LoginAttemptDecision.blockedDecision(seconds);
        }

        int exponent = Math.min(3, Math.max(0, strictest.count() - 1));
        long delayMillis = Math.min(1_200L, 150L * (1L << exponent));
        return LoginAttemptDecision.delayedDecision(delayMillis);
    }

    public void clearFailures(String clientIp, String email) {
        failures.remove("ip:" + clientIp);
        failures.remove("email:" + email);
    }

    private AttemptSnapshot addFailure(String key, Instant now) {
        Deque<Instant> attempts = getWindow(key);
        synchronized (attempts) {
            removeExpired(attempts, now);
            attempts.addLast(now);
            return new AttemptSnapshot(attempts.size(), attempts.peekFirst());
        }
    }

    private AttemptSnapshot snapshot(String key, Instant now) {
        Deque<Instant> attempts = getWindow(key);
        synchronized (attempts) {
            removeExpired(attempts, now);
            return new AttemptSnapshot(attempts.size(), attempts.peekFirst());
        }
    }

    private Deque<Instant> getWindow(String key) {
        if (failures.size() >= MAX_TRACKED_KEYS && !failures.containsKey(key)) {
            failures.keySet().stream().findAny().ifPresent(failures::remove);
        }
        return failures.computeIfAbsent(key, ignored -> new ArrayDeque<>());
    }

    private void removeExpired(Deque<Instant> attempts, Instant now) {
        Instant cutoff = now.minus(WINDOW);
        while (!attempts.isEmpty() && attempts.peekFirst().isBefore(cutoff)) {
            attempts.removeFirst();
        }
    }

    private record AttemptSnapshot(int count, Instant oldest) {
    }

    public record LoginAttemptDecision(boolean allowed, long delayMillis, long retryAfterSeconds) {
        public static LoginAttemptDecision allowedDecision() {
            return new LoginAttemptDecision(true, 0, 0);
        }

        public static LoginAttemptDecision delayedDecision(long delayMillis) {
            return new LoginAttemptDecision(true, delayMillis, 0);
        }

        public static LoginAttemptDecision blockedDecision(long retryAfterSeconds) {
            return new LoginAttemptDecision(false, 0, retryAfterSeconds);
        }
    }
}
