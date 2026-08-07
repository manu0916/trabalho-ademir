package com.ecommerce.hardware.service;

import com.ecommerce.hardware.config.MercadoPagoProperties;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Thin server-only client for Mercado Pago Checkout Pro. */
@Service
public class MercadoPagoClient {
    private static final URI PREFERENCES_URI = URI.create("https://api.mercadopago.com/checkout/preferences");
    private final MercadoPagoProperties properties;
    private final ObjectMapper objectMapper = JsonMapper.shared();
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public MercadoPagoClient(MercadoPagoProperties properties) {
        this.properties = properties;
    }

    public Preference createPreference(String externalReference, String fullName, String email, String cpf,
                                       List<CheckoutItem> items) {
        requireConfiguration();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items.stream().map(item -> Map.of(
                "id", item.productId().toString(), "title", item.productName(), "quantity", item.quantity(),
                "currency_id", "BRL", "unit_price", item.unitPrice())).toList());
        body.put("external_reference", externalReference);
        body.put("payer", Map.of("name", fullName, "email", email,
                "identification", Map.of("type", "CPF", "number", cpf)));
        body.put("notification_url", properties.getWebhookUrl());

        Map<String, String> backUrls = new LinkedHashMap<>();
        putIfPresent(backUrls, "success", properties.getSuccessUrl());
        putIfPresent(backUrls, "failure", properties.getFailureUrl());
        putIfPresent(backUrls, "pending", properties.getPendingUrl());
        if (!backUrls.isEmpty()) body.put("back_urls", backUrls);

        try {
            HttpRequest request = HttpRequest.newBuilder(PREFERENCES_URI)
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + properties.getAccessToken().trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível iniciar o pagamento.");
            }
            JsonNode result = objectMapper.readTree(response.body());
            String id = text(result, "id");
            String checkoutUrl = text(result, "init_point");
            if (id == null || checkoutUrl == null || !checkoutUrl.startsWith("https://")) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Resposta inválida do gateway de pagamento.");
            }
            return new Preference(id, checkoutUrl);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível conectar ao gateway de pagamento.");
        }
    }

    public GatewayPayment getPayment(String paymentId) {
        requireConfiguration();
        if (paymentId == null || !paymentId.matches("[A-Za-z0-9_-]{1,120}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identificador de pagamento inválido.");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.mercadopago.com/v1/payments/" + paymentId))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + properties.getAccessToken().trim())
                    .GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível verificar o pagamento.");
            }
            JsonNode result = objectMapper.readTree(response.body());
            return new GatewayPayment(text(result, "id"), text(result, "status"), text(result, "external_reference"));
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível verificar o pagamento.");
        }
    }

    private void requireConfiguration() {
        if (properties.getAccessToken() == null || properties.getAccessToken().isBlank()
                || properties.getWebhookUrl() == null || !properties.getWebhookUrl().startsWith("https://")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Gateway de pagamento ainda não foi configurado.");
        }
    }

    private static void putIfPresent(Map<String, String> target, String key, String value) {
        if (value != null && value.startsWith("https://")) target.put(key, value);
    }
    private static String text(JsonNode node, String name) {
        return node.path(name).isTextual() ? node.path(name).asText() : null;
    }

    public record CheckoutItem(Long productId, String productName, Integer quantity, BigDecimal unitPrice) { }
    public record Preference(String id, String checkoutUrl) { }
    public record GatewayPayment(String id, String status, String externalReference) { }
}
