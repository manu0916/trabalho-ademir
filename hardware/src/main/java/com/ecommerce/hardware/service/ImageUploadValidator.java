package com.ecommerce.hardware.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
/** Shared signature, media-type and dimension validation for uploaded store images. */
public class ImageUploadValidator {

    public static final int MAX_FILE_BYTES = 2 * 1024 * 1024;
    private static final long MAX_PIXELS = 16_000_000L;
    private static final int MAX_DIMENSION = 5_000;

    public ValidatedImage validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw badRequest("Selecione uma imagem para enviar.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "A imagem deve ter no máximo 2 MB.");
        }

        final byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw badRequest("Não foi possível ler a imagem enviada.");
        }
        if (bytes.length > MAX_FILE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "A imagem deve ter no máximo 2 MB.");
        }

        ImageMetadata metadata = inspect(bytes);
        validateDimensions(metadata.width(), metadata.height());
        verifyCompleteRaster(bytes, metadata);

        String declaredType = file.getContentType();
        if (declaredType != null && !declaredType.isBlank()
                && !"application/octet-stream".equalsIgnoreCase(declaredType)
                && !metadata.contentType().equalsIgnoreCase(declaredType)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "O tipo informado não corresponde ao conteúdo da imagem.");
        }
        return new ValidatedImage(bytes, metadata.contentType());
    }

    private ImageMetadata inspect(byte[] bytes) {
        if (isPng(bytes)) return inspectPng(bytes);
        if (isJpeg(bytes)) return inspectJpeg(bytes);
        if (isWebp(bytes)) return inspectWebp(bytes);
        throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Use uma imagem JPEG, PNG ou WebP.");
    }

    private boolean isPng(byte[] bytes) {
        byte[] signature = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
        if (bytes.length < signature.length) return false;
        for (int index = 0; index < signature.length; index++) {
            if (bytes[index] != signature[index]) return false;
        }
        return true;
    }

    private ImageMetadata inspectPng(byte[] bytes) {
        if (bytes.length < 33 || readUnsignedIntBigEndian(bytes, 8) != 13
                || !asciiEquals(bytes, 12, "IHDR")) {
            throw badRequest("O arquivo PNG está corrompido.");
        }
        long width = readUnsignedIntBigEndian(bytes, 16);
        long height = readUnsignedIntBigEndian(bytes, 20);
        return new ImageMetadata("image/png", width, height);
    }

    private void verifyCompleteRaster(byte[] bytes, ImageMetadata metadata) {
        // ImageIO decodes JPEG and PNG completely, rather than trusting only the
        // dimension header. WebP is checked structurally by inspectWebp because
        // the JDK does not ship a WebP ImageIO reader.
        if ("image/webp".equals(metadata.contentType())) return;

        if ("image/png".equals(metadata.contentType()) && !hasPngEndChunk(bytes)) {
            throw badRequest("O arquivo PNG está corrompido.");
        }
        if ("image/jpeg".equals(metadata.contentType()) && !hasJpegEndMarker(bytes)) {
            throw badRequest("O arquivo JPEG está corrompido.");
        }

        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            BufferedImage decoded = ImageIO.read(input);
            if (decoded == null || decoded.getWidth() != metadata.width()
                    || decoded.getHeight() != metadata.height()) {
                throw badRequest("A imagem enviada está corrompida.");
            }
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof ResponseStatusException responseStatusException) {
                throw responseStatusException;
            }
            throw badRequest("A imagem enviada está corrompida.");
        }
    }

    private boolean hasPngEndChunk(byte[] bytes) {
        int chunkOffset = bytes.length - 12;
        return chunkOffset >= 33
                && readUnsignedIntBigEndian(bytes, chunkOffset) == 0
                && asciiEquals(bytes, chunkOffset + 4, "IEND");
    }

    private boolean hasJpegEndMarker(byte[] bytes) {
        return bytes.length >= 4
                && unsigned(bytes[bytes.length - 2]) == 0xff
                && unsigned(bytes[bytes.length - 1]) == 0xd9;
    }

    private boolean isJpeg(byte[] bytes) {
        return bytes.length >= 4 && unsigned(bytes[0]) == 0xff && unsigned(bytes[1]) == 0xd8
                && unsigned(bytes[2]) == 0xff;
    }

    private ImageMetadata inspectJpeg(byte[] bytes) {
        int cursor = 2;
        while (cursor + 3 < bytes.length) {
            while (cursor < bytes.length && unsigned(bytes[cursor]) != 0xff) cursor++;
            while (cursor < bytes.length && unsigned(bytes[cursor]) == 0xff) cursor++;
            if (cursor >= bytes.length) break;

            int marker = unsigned(bytes[cursor++]);
            if (marker == 0xd9 || marker == 0xda) break;
            if (marker == 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
            if (cursor + 1 >= bytes.length) break;

            int segmentLength = readUnsignedShortBigEndian(bytes, cursor);
            if (segmentLength < 2 || cursor + segmentLength > bytes.length) break;
            if (isStartOfFrame(marker) && segmentLength >= 7) {
                long height = readUnsignedShortBigEndian(bytes, cursor + 3);
                long width = readUnsignedShortBigEndian(bytes, cursor + 5);
                return new ImageMetadata("image/jpeg", width, height);
            }
            cursor += segmentLength;
        }
        throw badRequest("O arquivo JPEG está corrompido.");
    }

    private boolean isStartOfFrame(int marker) {
        return switch (marker) {
            case 0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
                    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf -> true;
            default -> false;
        };
    }

    private boolean isWebp(byte[] bytes) {
        return bytes.length >= 20 && asciiEquals(bytes, 0, "RIFF") && asciiEquals(bytes, 8, "WEBP");
    }

    private ImageMetadata inspectWebp(byte[] bytes) {
        long declaredRiffSize = readUnsignedIntLittleEndian(bytes, 4) + 8;
        if (declaredRiffSize != bytes.length) {
            throw badRequest("O arquivo WebP está corrompido.");
        }

        int cursor = 12;
        ImageMetadata metadata = null;
        boolean hasImageBitstream = false;
        while (cursor + 8 <= bytes.length) {
            String chunk = new String(bytes, cursor, 4, StandardCharsets.US_ASCII);
            long chunkSize = readUnsignedIntLittleEndian(bytes, cursor + 4);
            long payloadEnd = (long) cursor + 8 + chunkSize;
            long next = payloadEnd + (chunkSize & 1);
            if (payloadEnd > bytes.length || next > bytes.length
                    || next > Integer.MAX_VALUE || next <= cursor) {
                throw badRequest("O arquivo WebP está corrompido.");
            }
            int payload = cursor + 8;

            if ("VP8X".equals(chunk) && chunkSize >= 10) {
                long width = 1 + readUnsigned24LittleEndian(bytes, payload + 4);
                long height = 1 + readUnsigned24LittleEndian(bytes, payload + 7);
                metadata = new ImageMetadata("image/webp", width, height);
            }
            if ("VP8L".equals(chunk) && chunkSize >= 5 && unsigned(bytes[payload]) == 0x2f) {
                long bits = readUnsignedIntLittleEndian(bytes, payload + 1);
                long width = 1 + (bits & 0x3fff);
                long height = 1 + ((bits >>> 14) & 0x3fff);
                if (metadata == null) metadata = new ImageMetadata("image/webp", width, height);
                hasImageBitstream = true;
            }
            if ("VP8 ".equals(chunk) && chunkSize >= 10
                    && unsigned(bytes[payload + 3]) == 0x9d
                    && unsigned(bytes[payload + 4]) == 0x01
                    && unsigned(bytes[payload + 5]) == 0x2a) {
                long width = readUnsignedShortLittleEndian(bytes, payload + 6) & 0x3fff;
                long height = readUnsignedShortLittleEndian(bytes, payload + 8) & 0x3fff;
                if (metadata == null) metadata = new ImageMetadata("image/webp", width, height);
                hasImageBitstream = true;
            }

            cursor = (int) next;
        }
        if (cursor != bytes.length || metadata == null || !hasImageBitstream) {
            throw badRequest("O arquivo WebP está corrompido.");
        }
        return metadata;
    }

    private void validateDimensions(long width, long height) {
        if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION
                || width * height > MAX_PIXELS) {
            throw badRequest("A imagem excede o limite de 5000 px ou 16 megapixels.");
        }
    }

    private boolean asciiEquals(byte[] bytes, int offset, String expected) {
        if (offset < 0 || offset + expected.length() > bytes.length) return false;
        for (int index = 0; index < expected.length(); index++) {
            if (unsigned(bytes[offset + index]) != expected.charAt(index)) return false;
        }
        return true;
    }

    private int unsigned(byte value) {
        return value & 0xff;
    }

    private int readUnsignedShortBigEndian(byte[] bytes, int offset) {
        return unsigned(bytes[offset]) << 8 | unsigned(bytes[offset + 1]);
    }

    private int readUnsignedShortLittleEndian(byte[] bytes, int offset) {
        return unsigned(bytes[offset]) | unsigned(bytes[offset + 1]) << 8;
    }

    private long readUnsigned24LittleEndian(byte[] bytes, int offset) {
        return unsigned(bytes[offset]) | (long) unsigned(bytes[offset + 1]) << 8
                | (long) unsigned(bytes[offset + 2]) << 16;
    }

    private long readUnsignedIntBigEndian(byte[] bytes, int offset) {
        return (long) unsigned(bytes[offset]) << 24 | (long) unsigned(bytes[offset + 1]) << 16
                | (long) unsigned(bytes[offset + 2]) << 8 | unsigned(bytes[offset + 3]);
    }

    private long readUnsignedIntLittleEndian(byte[] bytes, int offset) {
        return unsigned(bytes[offset]) | (long) unsigned(bytes[offset + 1]) << 8
                | (long) unsigned(bytes[offset + 2]) << 16 | (long) unsigned(bytes[offset + 3]) << 24;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record ValidatedImage(byte[] bytes, String contentType) {
    }

    private record ImageMetadata(String contentType, long width, long height) {
    }
}
