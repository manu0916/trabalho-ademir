package com.ecommerce.hardware.security;

import java.util.regex.Pattern;

/**
 * Utility for sanitizing user inputs to defend against Cross-Site Scripting (XSS),
 * HTML injection, control character abuse, and malformed unicode.
 */
public final class InputSanitizer {

    private static final Pattern SCRIPT_PATTERN = Pattern.compile("(?i)<script.*?>.*?</script.*?>");
    private static final Pattern STYLE_PATTERN = Pattern.compile("(?i)<style.*?>.*?</style.*?>");
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]+>");
    private static final Pattern JAVASCRIPT_PROTOCOL_PATTERN = Pattern.compile("(?i)javascript:");
    private static final Pattern VBSCRIPT_PROTOCOL_PATTERN = Pattern.compile("(?i)vbscript:");
    private static final Pattern DATA_PROTOCOL_PATTERN = Pattern.compile("(?i)data:text/html");
    private static final Pattern EVENT_HANDLER_PATTERN = Pattern.compile("(?i)\\bon[a-z]+\\s*=");
    private static final Pattern CONTROL_CHAR_PATTERN = Pattern.compile("[\\p{Cntrl}&&[^\r\n\t]]");

    private InputSanitizer() {
    }

    /**
     * Sanitizes a single-line or multi-line text input.
     * Strips malicious scripts, event handlers, javascript/vbscript protocols, and unprintable control characters.
     */
    public static String sanitizeText(String input) {
        if (input == null) {
            return null;
        }

        String cleaned = input;
        cleaned = SCRIPT_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = STYLE_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = HTML_TAG_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = JAVASCRIPT_PROTOCOL_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = VBSCRIPT_PROTOCOL_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = DATA_PROTOCOL_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = EVENT_HANDLER_PATTERN.matcher(cleaned).replaceAll("");
        cleaned = CONTROL_CHAR_PATTERN.matcher(cleaned).replaceAll("");

        return cleaned.trim();
    }

    /**
     * Sanitizes email address strings.
     */
    public static String sanitizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String cleaned = sanitizeText(email).toLowerCase();
        return cleaned.replaceAll("\\s+", "");
    }

    /**
     * Sanitizes filename to prevent directory traversal (e.g. "../", "..\\").
     */
    public static String sanitizeFilename(String filename) {
        if (filename == null) {
            return "file";
        }
        String cleanName = filename.replace("\\", "/");
        int lastSlash = cleanName.lastIndexOf('/');
        if (lastSlash >= 0) {
            cleanName = cleanName.substring(lastSlash + 1);
        }
        cleanName = cleanName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (cleanName.isBlank() || "..".equals(cleanName)) {
            cleanName = "file_" + System.currentTimeMillis();
        }
        return cleanName;
    }
}
