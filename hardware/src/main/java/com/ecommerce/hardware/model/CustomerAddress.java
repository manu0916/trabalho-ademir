package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

@Entity
@Table(name = "customer_addresses")
public class CustomerAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private CustomerAccount customer;

    @Column(nullable = false, length = 60)
    private String label;

    @Column(name = "postal_code", nullable = false, length = 8)
    private String postalCode;

    @Column(nullable = false, length = 2)
    private String state;

    @Column(nullable = false, length = 120)
    private String city;

    @Column(nullable = false, length = 160)
    private String neighborhood;

    @Column(nullable = false, length = 180)
    private String street;

    @Column(name = "address_number", nullable = false, length = 20)
    private String addressNumber;

    @Column(length = 120)
    private String complement;

    @Column(name = "is_default", nullable = false)
    private boolean defaultAddress;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected CustomerAddress() {
    }

    public CustomerAddress(CustomerAccount customer, String label, String postalCode, String state,
                           String city, String neighborhood, String street, String addressNumber,
                           String complement, boolean defaultAddress) {
        this.customer = customer;
        update(label, postalCode, state, city, neighborhood, street, addressNumber, complement);
        this.defaultAddress = defaultAddress;
    }

    public void update(String label, String postalCode, String state, String city, String neighborhood,
                       String street, String addressNumber, String complement) {
        this.label = label;
        this.postalCode = postalCode;
        this.state = state;
        this.city = city;
        this.neighborhood = neighborhood;
        this.street = street;
        this.addressNumber = addressNumber;
        this.complement = complement;
        this.updatedAt = Instant.now();
    }

    public void setDefaultAddress(boolean defaultAddress) {
        this.defaultAddress = defaultAddress;
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getCustomerId() { return customer == null ? null : customer.getId(); }
    public String getLabel() { return label; }
    public String getPostalCode() { return postalCode; }
    public String getState() { return state; }
    public String getCity() { return city; }
    public String getNeighborhood() { return neighborhood; }
    public String getStreet() { return street; }
    public String getAddressNumber() { return addressNumber; }
    public String getComplement() { return complement; }
    public boolean isDefaultAddress() { return defaultAddress; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
