package com.ecommerce.hardware.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Product {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String category;
    
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
    
    @Column(length = 500)
    private String imageUrl;
    
    @Column(length = 2000)
    private String description;

    /** Units currently available for sale. Updated only inside a database transaction. */
    @Column(nullable = false)
    private Integer stockQuantity = 0;

    @Version
    private Long version;

    /** Compatibility constructor for existing imports; new products should always set stock explicitly. */
    public Product(Long id, String name, String category, BigDecimal price, String imageUrl, String description) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.price = price;
        this.imageUrl = imageUrl;
        this.description = description;
        this.stockQuantity = 0;
    }
}
