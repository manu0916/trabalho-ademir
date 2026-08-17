package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.service.CustomerAccountService;
import com.ecommerce.hardware.service.CustomerAccountService.AccountView;
import com.ecommerce.hardware.service.CustomerAccountService.AddressInput;
import com.ecommerce.hardware.service.CustomerAccountService.AddressView;
import com.ecommerce.hardware.service.CustomerAccountService.ProfileView;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/customer/account")
public class CustomerAccountController {
    private final CustomerAccountService accounts;

    public CustomerAccountController(CustomerAccountService accounts) {
        this.accounts = accounts;
    }

    @GetMapping
    public AccountView account(HttpSession session, HttpServletResponse response) {
        noStore(response);
        return accounts.account(customerId(session));
    }

    @PutMapping("/profile")
    public ProfileView updateProfile(@Valid @RequestBody ProfileRequest request, HttpSession session,
                                     HttpServletResponse response) {
        noStore(response);
        return accounts.updateProfile(customerId(session), request.fullName(), request.email(), request.cpf());
    }

    @PostMapping("/addresses")
    public ResponseEntity<AddressView> createAddress(@Valid @RequestBody AddressRequest request,
                                                      HttpSession session, HttpServletResponse response) {
        noStore(response);
        AddressView created = accounts.createAddress(customerId(session), request.toInput());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/addresses/{addressId}")
    public AddressView updateAddress(@PathVariable Long addressId,
                                     @Valid @RequestBody AddressRequest request,
                                     HttpSession session, HttpServletResponse response) {
        noStore(response);
        return accounts.updateAddress(customerId(session), addressId, request.toInput());
    }

    @DeleteMapping("/addresses/{addressId}")
    public ResponseEntity<Void> deleteAddress(@PathVariable Long addressId, HttpSession session,
                                              HttpServletResponse response) {
        noStore(response);
        accounts.deleteAddress(customerId(session), addressId);
        return ResponseEntity.noContent().build();
    }

    private Long customerId(HttpSession session) {
        Object value = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(value instanceof Long customerId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        }
        return customerId;
    }

    private static void noStore(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, private");
        response.setHeader("Pragma", "no-cache");
    }

    public record ProfileRequest(@Size(max = 160) String fullName,
                                 @Size(max = 254) String email,
                                 @Size(max = 20) String cpf) { }

    public record AddressRequest(@Size(max = 60) String label,
                                 @Size(max = 10) String postalCode,
                                 @Size(max = 2) String state,
                                 @Size(max = 120) String city,
                                 @Size(max = 160) String neighborhood,
                                 @Size(max = 180) String street,
                                 @Size(max = 20) String addressNumber,
                                 @Size(max = 120) String complement,
                                 Boolean isDefault) {
        private AddressInput toInput() {
            return new AddressInput(label, postalCode, state, city, neighborhood, street, addressNumber,
                    complement, Boolean.TRUE.equals(isDefault));
        }
    }
}
