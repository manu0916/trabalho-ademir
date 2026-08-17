package com.ecommerce.hardware.service;

import com.ecommerce.hardware.controller.StorefrontHeroResponse;
import com.ecommerce.hardware.controller.StorefrontHeroResponse.ManualHeroImageResponse;
import com.ecommerce.hardware.controller.StorefrontHeroUpdateRequest;
import com.ecommerce.hardware.controller.StorefrontHeroUpdateRequest.ManualImageUpdate;
import com.ecommerce.hardware.model.HeroMode;
import com.ecommerce.hardware.model.StorefrontHeroImage;
import com.ecommerce.hardware.model.StorefrontHeroSettings;
import com.ecommerce.hardware.repository.StorefrontHeroImageRepository;
import com.ecommerce.hardware.repository.StorefrontHeroImageRepository.HeroImageMetadata;
import com.ecommerce.hardware.repository.StorefrontHeroSettingsRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class StorefrontHeroService {

    public static final int MAX_MANUAL_IMAGES = 8;
    private static final String DEFAULT_ALT_TEXT = "Tênis em destaque na Kicks Store";
    private static final String IMAGE_URL_PREFIX = "/api/storefront/hero/images/";

    private final StorefrontHeroSettingsRepository settingsRepository;
    private final StorefrontHeroImageRepository imageRepository;
    private final ImageUploadValidator imageValidator;

    public StorefrontHeroService(StorefrontHeroSettingsRepository settingsRepository,
                                 StorefrontHeroImageRepository imageRepository,
                                 ImageUploadValidator imageValidator) {
        this.settingsRepository = settingsRepository;
        this.imageRepository = imageRepository;
        this.imageValidator = imageValidator;
    }

    @Transactional(readOnly = true)
    public StorefrontHeroResponse getConfiguration() {
        StorefrontHeroSettings settings = settingsRepository
                .findById(StorefrontHeroSettings.SINGLETON_ID)
                .orElseGet(StorefrontHeroSettings::new);
        return response(settings, listImageMetadata());
    }

    @Transactional
    public StorefrontHeroResponse updateConfiguration(StorefrontHeroUpdateRequest request) {
        if (request.mode() == null && request.intervalSeconds() == null && request.manualImages() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Informe o modo, o intervalo ou a lista de imagens.");
        }

        StorefrontHeroSettings settings = getSettingsForUpdate();
        HeroMode effectiveMode = request.mode() == null ? settings.getMode() : request.mode();
        long imageCount = imageRepository.countBySettingsId(StorefrontHeroSettings.SINGLETON_ID);
        if (effectiveMode == HeroMode.MANUAL && imageCount == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Adicione pelo menos uma imagem antes de ativar o modo manual.");
        }

        settings.setMode(effectiveMode);
        if (request.intervalSeconds() != null) settings.setIntervalSeconds(request.intervalSeconds());
        if (request.manualImages() != null) reorderAndDescribeImages(request.manualImages());
        settingsRepository.saveAndFlush(settings);
        return response(settings, listImageMetadata());
    }

    @Transactional
    public StorefrontHeroResponse uploadImage(MultipartFile file, String altText) {
        ImageUploadValidator.ValidatedImage validated = imageValidator.validate(file);
        String normalizedAltText = normalizeAltText(altText);
        StorefrontHeroSettings settings = getSettingsForUpdate();
        long existingCount = imageRepository.countBySettingsId(StorefrontHeroSettings.SINGLETON_ID);
        if (existingCount >= MAX_MANUAL_IMAGES) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A galeria manual aceita no máximo 8 imagens.");
        }

        StorefrontHeroImage image = new StorefrontHeroImage();
        image.setSettingsId(StorefrontHeroSettings.SINGLETON_ID);
        image.setContentType(validated.contentType());
        image.setByteSize(validated.bytes().length);
        image.setImageBase64(Base64.getEncoder().encodeToString(validated.bytes()));
        image.setAltText(normalizedAltText);
        image.setSortOrder((int) existingCount);
        imageRepository.saveAndFlush(image);

        return response(settings, listImageMetadata());
    }

    @Transactional
    public StorefrontHeroResponse deleteImage(Long imageId) {
        StorefrontHeroSettings settings = getSettingsForUpdate();
        StorefrontHeroImage image = imageRepository
                .findByIdAndSettingsId(imageId, StorefrontHeroSettings.SINGLETON_ID)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Imagem do destaque não encontrada."));

        imageRepository.delete(image);
        imageRepository.flush();

        List<StorefrontHeroImage> remaining = listImagesForUpdate();
        persistImageOrder(remaining);

        if (remaining.isEmpty() && settings.getMode() == HeroMode.MANUAL) {
            settings.setMode(HeroMode.PRODUCTS);
            settingsRepository.saveAndFlush(settings);
        }
        return response(settings, listImageMetadata());
    }

    @Transactional(readOnly = true)
    public StoredHeroImage getImage(Long imageId) {
        StorefrontHeroImage image = imageRepository
                .findByIdAndSettingsId(imageId, StorefrontHeroSettings.SINGLETON_ID)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Imagem do destaque não encontrada."));
        try {
            byte[] bytes = Base64.getDecoder().decode(image.getImageBase64());
            return new StoredHeroImage(image.getId(), image.getContentType(), bytes);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "A imagem armazenada não pôde ser lida.");
        }
    }

    private StorefrontHeroSettings getSettingsForUpdate() {
        return settingsRepository.findByIdForUpdate(StorefrontHeroSettings.SINGLETON_ID)
                .orElseGet(() -> settingsRepository.saveAndFlush(new StorefrontHeroSettings()));
    }

    private List<StorefrontHeroImage> listImagesForUpdate() {
        return imageRepository.findAllBySettingsIdOrderBySortOrderAscIdAsc(
                StorefrontHeroSettings.SINGLETON_ID);
    }

    private List<HeroImageMetadata> listImageMetadata() {
        return imageRepository.findMetadataBySettingsId(StorefrontHeroSettings.SINGLETON_ID);
    }

    private StorefrontHeroResponse response(StorefrontHeroSettings settings,
                                            List<HeroImageMetadata> images) {
        List<ManualHeroImageResponse> manualImages = images.stream()
                .map(image -> new ManualHeroImageResponse(image.getId(), IMAGE_URL_PREFIX + image.getId(),
                        image.getAltText(), image.getSortOrder()))
                .toList();
        return new StorefrontHeroResponse(settings.getMode(), settings.getIntervalSeconds(), manualImages);
    }

    private void reorderAndDescribeImages(List<ManualImageUpdate> requestedImages) {
        List<StorefrontHeroImage> currentImages = listImagesForUpdate();
        if (requestedImages.size() != currentImages.size()) {
            throw invalidImageList();
        }

        Map<Long, StorefrontHeroImage> imagesById = new HashMap<>();
        for (StorefrontHeroImage image : currentImages) imagesById.put(image.getId(), image);

        Set<Long> seenIds = new HashSet<>();
        List<StorefrontHeroImage> orderedImages = requestedImages.stream().map(requested -> {
            if (!seenIds.add(requested.id())) throw invalidImageList();
            StorefrontHeroImage image = imagesById.get(requested.id());
            if (image == null) throw invalidImageList();
            image.setAltText(normalizeAltText(requested.altText()));
            return image;
        }).toList();
        if (seenIds.size() != imagesById.size()) throw invalidImageList();

        persistImageOrder(orderedImages);
    }

    private void persistImageOrder(List<StorefrontHeroImage> orderedImages) {
        // Move every row to a disjoint temporary range before assigning the final
        // positions. This avoids transient UNIQUE(settings_id, sort_order) collisions
        // for swaps and compaction on both H2 and PostgreSQL.
        for (int index = 0; index < orderedImages.size(); index++) {
            orderedImages.get(index).setSortOrder(100 + index);
        }
        imageRepository.saveAllAndFlush(orderedImages);
        for (int index = 0; index < orderedImages.size(); index++) {
            orderedImages.get(index).setSortOrder(index);
        }
        imageRepository.saveAllAndFlush(orderedImages);
    }

    private ResponseStatusException invalidImageList() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "A lista deve conter cada imagem atual exatamente uma vez.");
    }

    private String normalizeAltText(String altText) {
        if (altText == null || altText.isBlank()) return DEFAULT_ALT_TEXT;
        String normalized = altText.trim();
        if (normalized.length() > 160) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O texto alternativo deve ter no máximo 160 caracteres.");
        }
        if (normalized.codePoints().anyMatch(codePoint -> Character.isISOControl(codePoint))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O texto alternativo contém caracteres inválidos.");
        }
        return normalized;
    }

    public record StoredHeroImage(Long id, String contentType, byte[] bytes) {
    }
}
