package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.service.StorefrontHeroService;
import com.ecommerce.hardware.service.StorefrontHeroService.StoredHeroImage;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

@RestController
@RequestMapping("/api/storefront/hero")
public class StorefrontHeroController {

    private final StorefrontHeroService heroService;

    public StorefrontHeroController(StorefrontHeroService heroService) {
        this.heroService = heroService;
    }

    @GetMapping
    public StorefrontHeroResponse configuration() {
        return heroService.getConfiguration();
    }

    @PatchMapping
    public StorefrontHeroResponse updateConfiguration(
            @Valid @RequestBody StorefrontHeroUpdateRequest request) {
        return heroService.updateConfiguration(request);
    }

    @PostMapping(path = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public StorefrontHeroResponse uploadImage(@RequestPart("file") MultipartFile file,
                                              @RequestParam(value = "altText", required = false) String altText) {
        return heroService.uploadImage(file, altText);
    }

    @GetMapping("/images/{id}")
    public ResponseEntity<byte[]> image(@PathVariable Long id) {
        StoredHeroImage image = heroService.getImage(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .contentLength(image.bytes().length)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .eTag("\"hero-image-" + image.id() + "\"")
                .body(image.bytes());
    }

    @DeleteMapping("/images/{id}")
    public StorefrontHeroResponse deleteImage(@PathVariable Long id) {
        return heroService.deleteImage(id);
    }
}
