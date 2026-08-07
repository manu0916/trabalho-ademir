package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.CustomerAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerAccountRepository extends JpaRepository<CustomerAccount, Long> {
    boolean existsByUsernameIgnoreCase(String username);
    Optional<CustomerAccount> findByUsernameIgnoreCase(String username);
}
