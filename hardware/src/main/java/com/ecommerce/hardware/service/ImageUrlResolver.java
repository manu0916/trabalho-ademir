package com.ecommerce.hardware.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ImageUrlResolver {

    private static final Pattern META_IMAGE = Pattern.compile(
            "(?is)<meta[^>]+(?:property|name)=['\"](?:og:image|twitter:image|twitter:image:src)['\"][^>]+content=['\"]([^'\"]+)['\"]"
    );
    private static final Pattern IMG_SRC = Pattern.compile("(?is)<img[^>]+src=['\"]([^'\"]+)['\"]");
    private static final Pattern STYLE_URL = Pattern.compile("(?is)url\\(['\"]?([^'\"\\)]+)['\"]?\\)");

    public String resolve(String inputUrl) {
        String trimmed = inputUrl == null ? null : inputUrl.trim();
        if (trimmed == null || trimmed.isBlank()) {
            return trimmed;
        }

        if (looksLikeDirectImage(trimmed)) {
            return trimmed;
        }

        try {
            String html = fetch(trimmed);
            String resolved = firstMatch(html, META_IMAGE, trimmed);
            if (resolved != null) return resolved;

            resolved = firstMatch(html, IMG_SRC, trimmed);
            if (resolved != null) return resolved;

            return firstMatch(html, STYLE_URL, trimmed);
        } catch (Exception ignored) {
            return trimmed;
        }
    }

    private boolean looksLikeDirectImage(String url) {
        String path = URI.create(url).getPath();
        if (path == null) return false;
        String lower = path.toLowerCase();
        return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")
                || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".bmp")
                || lower.endsWith(".svg") || lower.endsWith(".avif");
    }

    private String fetch(String url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0");
        connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        try (var stream = connection.getInputStream()) {
            byte[] data = stream.readNBytes(200_000);
            return new String(data, StandardCharsets.UTF_8);
        } finally {
            connection.disconnect();
        }
    }

    private String firstMatch(String html, Pattern pattern, String baseUrl) {
        Matcher matcher = pattern.matcher(html);
        if (!matcher.find()) {
            return null;
        }
        String candidate = matcher.group(1).trim();
        if (candidate.isBlank()) {
            return null;
        }
        return normalizeUrl(baseUrl, candidate);
    }

    private String normalizeUrl(String baseUrl, String candidate) {
        if (candidate.startsWith("//")) {
            return URI.create(baseUrl).getScheme() + ":" + candidate;
        }
        if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
            return candidate;
        }
        return URI.create(baseUrl).resolve(candidate).toString();
    }
}
