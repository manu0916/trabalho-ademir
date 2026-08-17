package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.CustomerAddress;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, Long> {
    List<CustomerAddress> findByCustomer_IdOrderByDefaultAddressDescCreatedAtAsc(Long customerId);
    Optional<CustomerAddress> findByIdAndCustomer_Id(Long id, Long customerId);
    long countByCustomer_Id(Long customerId);
}
