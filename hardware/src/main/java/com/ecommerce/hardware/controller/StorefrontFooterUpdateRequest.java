package com.ecommerce.hardware.controller;

import jakarta.validation.constraints.Size;

public record StorefrontFooterUpdateRequest(
        @Size(max = 100, message = "O letreiro da marca nao pode ter mais de 100 caracteres.")
        String wordmark,

        @Size(max = 255, message = "O slogan/tagline da marca nao pode ter mais de 255 caracteres.")
        String brandTagline,

        @Size(max = 100, message = "O titulo de localizacao nao pode ter mais de 100 caracteres.")
        String locationTitle,

        @Size(max = 255, message = "O endereco linha 1 nao pode ter mais de 255 caracteres.")
        String addressLine1,

        @Size(max = 255, message = "O endereco linha 2 nao pode ter mais de 255 caracteres.")
        String addressLine2,

        @Size(max = 100, message = "O titulo de horarios nao pode ter mais de 100 caracteres.")
        String hoursTitle,

        @Size(max = 255, message = "O horario de funcionamento linha 1 nao pode ter mais de 255 caracteres.")
        String storeHoursLine1,

        @Size(max = 255, message = "O horario de funcionamento linha 2 nao pode ter mais de 255 caracteres.")
        String storeHoursLine2,

        @Size(max = 100, message = "O titulo de autenticidade nao pode ter mais de 100 caracteres.")
        String authTitle,

        @Size(max = 255, message = "O titulo do selo nao pode ter mais de 255 caracteres.")
        String authBadgeTitle,

        @Size(max = 255, message = "O detalhe do selo nao pode ter mais de 255 caracteres.")
        String authBadgeDetail,

        @Size(max = 100, message = "O titulo de navegacao nao pode ter mais de 100 caracteres.")
        String navTitle,

        @Size(max = 100, message = "O texto do botao voltar ao topo nao pode ter mais de 100 caracteres.")
        String backToTopText,

        @Size(max = 254, message = "O e-mail de contato nao pode ter mais de 254 caracteres.")
        String contactEmail,

        @Size(max = 100, message = "O telefone de contato nao pode ter mais de 100 caracteres.")
        String contactPhone,

        @Size(max = 100, message = "O CNPJ/razao social nao pode ter mais de 100 caracteres.")
        String cnpjText,

        @Size(max = 100, message = "O usuario do Instagram nao pode ter mais de 100 caracteres.")
        String instagramHandle,

        @Size(max = 255, message = "O trilho de cidades nao pode ter mais de 255 caracteres.")
        String citiesRail,

        @Size(max = 255, message = "O texto de copyright nao pode ter mais de 255 caracteres.")
        String copyrightText
) {
}
