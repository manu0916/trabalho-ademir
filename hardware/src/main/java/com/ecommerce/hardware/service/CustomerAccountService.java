package com.ecommerce.hardware.service;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.model.CustomerAddress;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.CustomerAddressRepository;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerAccountService {
    private static final int MAX_ADDRESSES = 10;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern CPF_INPUT_PATTERN = Pattern.compile("[0-9.\\-\\s]*");
    private static final Pattern POSTAL_CODE_INPUT_PATTERN = Pattern.compile("[0-9\\-\\s]*");

    private final CustomerAccountRepository accounts;
    private final CustomerAddressRepository addresses;

    public CustomerAccountService(CustomerAccountRepository accounts, CustomerAddressRepository addresses) {
        this.accounts = accounts;
        this.addresses = addresses;
    }

    @Transactional(readOnly = true)
    public AccountView account(Long customerId) {
        CustomerAccount account = requireAccount(customerId);
        ProfileView profile = account.hasCompleteProfile() ? profileView(account) : null;
        List<AddressView> savedAddresses = addresses
                .findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId).stream()
                .map(CustomerAccountService::addressView)
                .toList();
        return new AccountView(account.getUsername(), profile, savedAddresses);
    }

    @Transactional
    public ProfileView updateProfile(Long customerId, String fullName, String email, String cpf) {
        CustomerAccount account = requireAccountForUpdate(customerId);
        String normalizedCpf = cpfDigits(cpf);
        if (normalizedCpf.isEmpty()) {
            if (!account.hasCompleteProfile()) throw badRequest("Informe um CPF válido.");
            normalizedCpf = null;
        } else if (!isValidCpf(normalizedCpf)) {
            throw badRequest("CPF inválido.");
        }
        account.updateProfile(normalizeFullName(fullName), normalizeEmail(email), normalizedCpf);
        return profileView(account);
    }

    @Transactional
    public AddressView createAddress(Long customerId, AddressInput input) {
        CustomerAccount account = requireAccountForUpdate(customerId);
        NormalizedAddress normalized = normalizeAddress(input, true);
        if (addresses.countByCustomer_Id(customerId) >= MAX_ADDRESSES) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Você pode cadastrar no máximo 10 endereços.");
        }
        List<CustomerAddress> current = addresses
                .findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId);
        boolean makeDefault = current.isEmpty() || normalized.makeDefault();
        if (makeDefault) {
            clearDefault(current);
            addresses.flush();
        }
        CustomerAddress saved = addresses.save(new CustomerAddress(account, normalized.label(),
                normalized.postalCode(), normalized.state(), normalized.city(), normalized.neighborhood(),
                normalized.street(), normalized.addressNumber(), normalized.complement(), makeDefault));
        return addressView(saved);
    }

    @Transactional
    public AddressView updateAddress(Long customerId, Long addressId, AddressInput input) {
        requireAccountForUpdate(customerId);
        CustomerAddress address = requireOwnedAddress(customerId, addressId);
        NormalizedAddress normalized = normalizeAddress(input, true);
        address.update(normalized.label(), normalized.postalCode(), normalized.state(), normalized.city(),
                normalized.neighborhood(), normalized.street(), normalized.addressNumber(), normalized.complement());
        if (normalized.makeDefault() && !address.isDefaultAddress()) {
            clearDefault(addresses.findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId));
            addresses.flush();
            address.setDefaultAddress(true);
        }
        return addressView(address);
    }

    @Transactional
    public void deleteAddress(Long customerId, Long addressId) {
        requireAccountForUpdate(customerId);
        CustomerAddress address = requireOwnedAddress(customerId, addressId);
        boolean wasDefault = address.isDefaultAddress();
        addresses.delete(address);
        addresses.flush();
        if (wasDefault) {
            addresses.findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId).stream()
                    .findFirst()
                    .ifPresent(next -> next.setDefaultAddress(true));
        }
    }

    /** Resolves a trusted checkout snapshot without changing the customer's account. */
    @Transactional(readOnly = true)
    public CheckoutResolution previewCheckout(Long customerId, CheckoutInput input) {
        return resolveCheckout(customerId, input, false);
    }

    /**
     * Applies the optional profile/address saves after the payment service has accepted the
     * idempotency key. This method joins the payment transaction, so a failed order preparation
     * also rolls these account changes back.
     */
    @Transactional
    public CheckoutResolution persistCheckout(Long customerId, CheckoutInput input) {
        return resolveCheckout(customerId, input, true);
    }

    private CheckoutResolution resolveCheckout(Long customerId, CheckoutInput input, boolean persist) {
        CustomerAccount account = persist ? requireAccountForUpdate(customerId) : requireAccount(customerId);
        String mode = input.personalDataMode() == null || input.personalDataMode().isBlank()
                ? hasAny(input.fullName(), input.email(), input.cpf()) ? "NEW" : "SAVED"
                : input.personalDataMode().trim().toUpperCase(Locale.ROOT);

        String fullName;
        String email;
        String cpf;
        boolean profileTarget;
        if ("SAVED".equals(mode)) {
            if (!account.hasCompleteProfile()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cadastre seus dados pessoais antes de usar o perfil salvo.");
            }
            fullName = account.getFullName();
            email = account.getEmail();
            cpf = account.getCpf();
            profileTarget = true;
        } else if ("NEW".equals(mode)) {
            fullName = normalizeFullName(input.fullName());
            email = normalizeEmail(input.email());
            cpf = cpfDigits(input.cpf());
            if (!isValidCpf(cpf)) throw badRequest("CPF inválido.");
            if (persist && input.saveProfile()) account.updateProfile(fullName, email, cpf);
            profileTarget = input.saveProfile();
        } else {
            throw badRequest("Seleção de dados pessoais inválida.");
        }

        NormalizedAddress address;
        Long selectedAddressId = input.addressId();
        boolean addressTarget = false;
        boolean defaultAddressTarget = false;
        String targetAddressLabel = null;
        if (selectedAddressId != null) {
            if (input.saveAddress() || hasAddressData(input.address())) {
                throw badRequest("Escolha um endereço salvo ou informe um novo endereço, não os dois.");
            }
            CustomerAddress saved = requireOwnedAddress(customerId, selectedAddressId);
            address = fromEntity(saved);
            addressTarget = true;
            defaultAddressTarget = saved.isDefaultAddress();
            targetAddressLabel = saved.getLabel();
        } else {
            address = normalizeAddress(input.address(), input.saveAddress());
            if (input.saveAddress()) {
                addressTarget = true;
                CustomerAddress saved = findEquivalent(customerId, address);
                if (saved == null) {
                    List<CustomerAddress> current = addresses
                            .findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId);
                    if (current.size() >= MAX_ADDRESSES) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Você pode cadastrar no máximo 10 endereços.");
                    }
                    boolean makeDefault = current.isEmpty() || address.makeDefault();
                    defaultAddressTarget = makeDefault;
                    targetAddressLabel = address.label();
                    if (persist) {
                        if (makeDefault) {
                            clearDefault(current);
                            addresses.flush();
                        }
                        saved = addresses.save(new CustomerAddress(account, address.label(), address.postalCode(),
                                address.state(), address.city(), address.neighborhood(), address.street(),
                                address.addressNumber(), address.complement(), makeDefault));
                    }
                } else {
                    defaultAddressTarget = saved.isDefaultAddress() || address.makeDefault();
                    targetAddressLabel = saved.getLabel();
                    if (persist && address.makeDefault() && !saved.isDefaultAddress()) {
                        clearDefault(addresses.findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId));
                        addresses.flush();
                        saved.setDefaultAddress(true);
                    }
                }
                if (saved != null) selectedAddressId = saved.getId();
            }
        }

        return new CheckoutResolution(fullName, email, cpf, address.postalCode(), address.state(),
                address.city(), address.neighborhood(), address.street(), address.addressNumber(),
                address.complement(), selectedAddressId, profileTarget, addressTarget,
                defaultAddressTarget, targetAddressLabel);
    }

    private CustomerAddress findEquivalent(Long customerId, NormalizedAddress candidate) {
        return addresses.findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(customerId).stream()
                .filter(address -> Objects.equals(address.getPostalCode(), candidate.postalCode())
                        && Objects.equals(address.getState(), candidate.state())
                        && Objects.equals(address.getCity(), candidate.city())
                        && Objects.equals(address.getNeighborhood(), candidate.neighborhood())
                        && Objects.equals(address.getStreet(), candidate.street())
                        && Objects.equals(address.getAddressNumber(), candidate.addressNumber())
                        && Objects.equals(address.getComplement(), candidate.complement()))
                .findFirst().orElse(null);
    }

    private CustomerAccount requireAccount(Long customerId) {
        if (customerId == null) throw unauthorized();
        return accounts.findById(customerId).orElseThrow(CustomerAccountService::unauthorized);
    }

    private CustomerAccount requireAccountForUpdate(Long customerId) {
        if (customerId == null) throw unauthorized();
        return accounts.findByIdForUpdate(customerId).orElseThrow(CustomerAccountService::unauthorized);
    }

    private CustomerAddress requireOwnedAddress(Long customerId, Long addressId) {
        if (addressId == null || addressId <= 0) throw notFound();
        return addresses.findByIdAndCustomer_Id(addressId, customerId)
                .orElseThrow(CustomerAccountService::notFound);
    }

    private static void clearDefault(List<CustomerAddress> current) {
        current.stream().filter(CustomerAddress::isDefaultAddress)
                .forEach(address -> address.setDefaultAddress(false));
    }

    private static NormalizedAddress normalizeAddress(AddressInput input, boolean requireLabel) {
        if (input == null) throw badRequest("Preencha todos os dados do endereço.");
        String label = normalizeOptional(input.label());
        if (requireLabel && (label == null || label.length() > 60)) {
            throw badRequest("Informe um nome para o endereço.");
        }
        if (label == null) label = "Endereço principal";
        String postalCode = postalCodeDigits(input.postalCode());
        String state = normalizeOptional(input.state());
        String city = normalizeOptional(input.city());
        String neighborhood = normalizeOptional(input.neighborhood());
        String street = normalizeOptional(input.street());
        String addressNumber = normalizeOptional(input.addressNumber());
        String complement = normalizeOptional(input.complement());
        if (postalCode.length() != 8) throw badRequest("Informe um CEP válido.");
        if (state == null || !state.matches("[A-Za-z]{2}")) throw badRequest("Informe o estado.");
        if (invalid(city, 120) || invalid(neighborhood, 160) || invalid(street, 180)
                || invalid(addressNumber, 20) || complement != null && complement.length() > 120) {
            throw badRequest("Preencha todos os dados do endereço.");
        }
        return new NormalizedAddress(label, postalCode, state.toUpperCase(Locale.ROOT), city,
                neighborhood, street, addressNumber, complement, input.makeDefault());
    }

    private static NormalizedAddress fromEntity(CustomerAddress address) {
        return new NormalizedAddress(address.getLabel(), address.getPostalCode(), address.getState(),
                address.getCity(), address.getNeighborhood(), address.getStreet(), address.getAddressNumber(),
                address.getComplement(), address.isDefaultAddress());
    }

    private static String normalizeFullName(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null || normalized.length() < 5 || normalized.length() > 160) {
            throw badRequest("Informe o nome completo.");
        }
        return normalized.replaceAll("\\s+", " ");
    }

    private static String normalizeEmail(String value) {
        String normalized = normalizeOptional(value);
        if (normalized == null || normalized.length() > 254 || !EMAIL_PATTERN.matcher(normalized).matches()) {
            throw badRequest("Informe um e-mail válido.");
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    private static String normalizeOptional(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        return value.trim();
    }

    private static String cpfDigits(String value) {
        return allowedDigits(value, CPF_INPUT_PATTERN, "CPF inválido.");
    }

    private static String postalCodeDigits(String value) {
        return allowedDigits(value, POSTAL_CODE_INPUT_PATTERN, "Informe um CEP válido.");
    }

    private static String allowedDigits(String value, Pattern allowedInput, String message) {
        if (value == null) return "";
        if (!allowedInput.matcher(value).matches()) throw badRequest(message);
        return value.replaceAll("\\D", "");
    }

    private static boolean isValidCpf(String value) {
        String cpf = value == null ? "" : value;
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) return false;
        return cpfDigit(cpf, 9) == cpf.charAt(9) - '0' && cpfDigit(cpf, 10) == cpf.charAt(10) - '0';
    }

    private static int cpfDigit(String cpf, int length) {
        int total = 0;
        for (int index = 0; index < length; index++) {
            total += (cpf.charAt(index) - '0') * (length + 1 - index);
        }
        int value = (total * 10) % 11;
        return value == 10 ? 0 : value;
    }

    private static boolean hasAny(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return true;
        return false;
    }

    private static boolean hasAddressData(AddressInput input) {
        return input != null && hasAny(input.label(), input.postalCode(), input.state(), input.city(),
                input.neighborhood(), input.street(), input.addressNumber(), input.complement());
    }

    private static boolean invalid(String value, int maxLength) {
        return value == null || value.length() > maxLength;
    }

    private static ProfileView profileView(CustomerAccount account) {
        String cpf = account.getCpf();
        String masked = cpf == null || cpf.length() != 11 ? null : "***.***.***-" + cpf.substring(9);
        return new ProfileView(account.getFullName(), account.getEmail(), masked, cpf != null);
    }

    private static AddressView addressView(CustomerAddress address) {
        return new AddressView(address.getId(), address.getLabel(), address.getPostalCode(), address.getState(),
                address.getCity(), address.getNeighborhood(), address.getStreet(), address.getAddressNumber(),
                address.getComplement(), address.isDefaultAddress());
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Endereço não encontrado.");
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record AccountView(String username, ProfileView profile, List<AddressView> addresses) { }
    public record ProfileView(String fullName, String email, String cpfMasked, boolean hasCpf) { }
    public record AddressView(Long id, String label, String postalCode, String state, String city,
                              String neighborhood, String street, String addressNumber, String complement,
                              boolean isDefault) { }
    public record AddressInput(String label, String postalCode, String state, String city, String neighborhood,
                               String street, String addressNumber, String complement, boolean makeDefault) { }
    public record CheckoutInput(String personalDataMode, String fullName, String email, String cpf,
                                boolean saveProfile, Long addressId, AddressInput address, boolean saveAddress) { }
    public record CheckoutResolution(String fullName, String email, String cpf, String postalCode, String state,
                                     String city, String neighborhood, String street, String addressNumber,
                                     String complement, Long addressId, boolean profileTarget,
                                     boolean addressTarget, boolean defaultAddressTarget, String addressLabel) { }

    private record NormalizedAddress(String label, String postalCode, String state, String city,
                                     String neighborhood, String street, String addressNumber, String complement,
                                     boolean makeDefault) { }
}
