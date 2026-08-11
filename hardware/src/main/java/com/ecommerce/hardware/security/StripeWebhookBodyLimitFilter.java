package com.ecommerce.hardware.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/** Buffers only the signed Stripe endpoint, stopping after the first byte above its hard limit. */
public final class StripeWebhookBodyLimitFilter extends OncePerRequestFilter {

    public static final int MAX_WEBHOOK_BYTES = 1_048_576;
    private static final String WEBHOOK_PATH = "/api/payments/stripe/webhook";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod()) || !isStripeWebhookPath(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_WEBHOOK_BYTES) {
            rejectPayloadTooLarge(response);
            return;
        }

        byte[] buffered = new byte[MAX_WEBHOOK_BYTES + 1];
        int bufferedBytes = 0;
        ServletInputStream input = request.getInputStream();
        while (bufferedBytes < buffered.length) {
            int read = input.read(buffered, bufferedBytes, buffered.length - bufferedBytes);
            if (read < 0) break;
            if (read == 0) {
                int single = input.read();
                if (single < 0) break;
                buffered[bufferedBytes++] = (byte) single;
            } else {
                bufferedBytes += read;
            }
        }
        if (bufferedBytes > MAX_WEBHOOK_BYTES) {
            rejectPayloadTooLarge(response);
            return;
        }

        filterChain.doFilter(new BufferedBodyRequest(request, buffered, bufferedBytes), response);
    }

    static boolean isStripeWebhookPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }
        return WEBHOOK_PATH.equals(uri);
    }

    static void rejectPayloadTooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"message\":\"Payload do webhook muito grande.\"}");
    }

    private static final class BufferedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        private final int bodyLength;

        private BufferedBodyRequest(HttpServletRequest request, byte[] body, int bodyLength) {
            super(request);
            this.body = body;
            this.bodyLength = bodyLength;
        }

        @Override
        public ServletInputStream getInputStream() {
            return new ByteArrayServletInputStream(body, bodyLength);
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override
        public int getContentLength() {
            return bodyLength;
        }

        @Override
        public long getContentLengthLong() {
            return bodyLength;
        }
    }

    private static final class ByteArrayServletInputStream extends ServletInputStream {
        private final ByteArrayInputStream input;

        private ByteArrayServletInputStream(byte[] body, int bodyLength) {
            this.input = new ByteArrayInputStream(body, 0, bodyLength);
        }

        @Override
        public int read() {
            return input.read();
        }

        @Override
        public int read(byte[] bytes, int offset, int length) {
            return input.read(bytes, offset, length);
        }

        @Override
        public boolean isFinished() {
            return input.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener listener) {
            if (listener == null) throw new IllegalArgumentException("ReadListener is required.");
            try {
                if (!isFinished()) listener.onDataAvailable();
                if (isFinished()) listener.onAllDataRead();
            } catch (IOException exception) {
                listener.onError(exception);
            }
        }
    }
}
