package com.ecommerce.hardware.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private CustomerAccount customer;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(nullable = false, length = 11)
    private String cpf;

    @Column(name = "payment_method", nullable = false, length = 30)
    private String paymentMethod;

    @Column(name = "postal_code", length = 8)
    private String postalCode;

    @Column(length = 2)
    private String state;

    @Column(length = 120)
    private String city;

    @Column(length = 160)
    private String neighborhood;

    @Column(length = 180)
    private String street;

    @Column(name = "address_number", length = 20)
    private String addressNumber;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(nullable = false, length = 30)
    private String status = "PENDING_PAYMENT";

    @Column(name = "external_reference", unique = true, length = 80)
    private String externalReference;

    @Column(name = "payment_preference_id", unique = true, length = 120)
    private String paymentPreferenceId;

    @Column(name = "gateway_payment_id", unique = true, length = 120)
    private String gatewayPaymentId;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseOrderItem> items = new ArrayList<>();

    protected PurchaseOrder() {
    }

    public PurchaseOrder(CustomerAccount customer, String fullName, String email, String cpf,
                         String paymentMethod, BigDecimal total) {
        this(customer, fullName, email, cpf, paymentMethod, null, null, null, null, null, null, total);
    }

    public PurchaseOrder(CustomerAccount customer, String fullName, String email, String cpf, String paymentMethod,
                         String postalCode, String state, String city, String neighborhood, String street,
                         String addressNumber, BigDecimal total) {
        this.customer = customer;
        this.fullName = fullName;
        this.email = email;
        this.cpf = cpf;
        this.paymentMethod = paymentMethod;
        this.postalCode = postalCode;
        this.state = state;
        this.city = city;
        this.neighborhood = neighborhood;
        this.street = street;
        this.addressNumber = addressNumber;
        this.total = total;
    }

    public void addItem(PurchaseOrderItem item) {
        item.setPurchaseOrder(this);
        items.add(item);
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getCpf() { return cpf; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getPostalCode() { return postalCode; }
    public String getState() { return state; }
    public String getCity() { return city; }
    public String getNeighborhood() { return neighborhood; }
    public String getStreet() { return street; }
    public String getAddressNumber() { return addressNumber; }
    public BigDecimal getTotal() { return total; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public List<PurchaseOrderItem> getItems() { return items; }
    public String getExternalReference() { return externalReference; }
    public String getPaymentPreferenceId() { return paymentPreferenceId; }
    public String getGatewayPaymentId() { return gatewayPaymentId; }
    public Instant getPaidAt() { return paidAt; }
    public void setExternalReference(String externalReference) { this.externalReference = externalReference; }
    public void setPaymentPreferenceId(String paymentPreferenceId) { this.paymentPreferenceId = paymentPreferenceId; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public void markPaid(String gatewayPaymentId) {
        this.status = "PAID";
        this.gatewayPaymentId = gatewayPaymentId;
        this.paidAt = Instant.now();
    }
}
