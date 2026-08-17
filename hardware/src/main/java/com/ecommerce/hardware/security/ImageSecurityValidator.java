package com.ecommerce.hardware.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Set;

/**
 * Validates uploaded image payloads using Magic Bytes (file signatures) to prevent
 * malicious payload execution, webshells, or disguised executables.
 */
public final class ImageSecurityValidator {

    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif"
    );

    private static final Set<String> DANGEROUS_EXTENSIONS = Set.of(
            "exe", "sh", "bat", "cmd", "php", "jsp", "asp", "aspx", "js", "html", "htm", "svg", "jar", "war", "py", "pl"
    );

    private ImageSecurityValidator() {
    }

    /**
     * Validates image bytes against recognized magic number signatures.
     */
    public static void validateImageBytes(byte[] bytes, String filename) {
        if (bytes == null || bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Arquivo de imagem vazio.");
        }

        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Imagem excede o limite máximo de 5 MB.");
        }

        if (filename != null) {
            String lowerName = filename.toLowerCase();
            for (String dangerous : DANGEROUS_EXTENSIONS) {
                if (lowerName.endsWith("." + dangerous) || lowerName.contains("." + dangerous + ".")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de arquivo não permitido por segurança.");
                }
            }
        }

        if (!hasValidImageMagicBytes(bytes)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Arquivo corrompido ou formato de imagem não suportado (permitidos: JPG, PNG, WEBP, GIF).");
        }
    }

    private static boolean hasValidImageMagicBytes(byte[] bytes) {
        if (bytes.length < 12) {
            return false;
        }

        // JPEG: FF D8 FF
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return true;
        }

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if ((bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50
                && (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47
                && (bytes[4] & 0xFF) == 0x0D && (bytes[5] & 0xFF) == 0x0A
                && (bytes[6] & 0xFF) == 0x1A && (bytes[7] & 0xFF) == 0x0A) {
            return true;
        }

        // GIF: GIF87a or GIF89a (47 49 46 38 37 61 / 47 49 46 38 39 61)
        if (bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == '8'
                && (bytes[4] == '7' || bytes[4] == '9') && bytes[5] == 'a') {
            return true;
        }

        // WebP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return true;
        }

        return false;
    }
}
