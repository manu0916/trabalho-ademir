package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.SupportMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportMessageRepository extends JpaRepository<SupportMessage, Long> {

    List<SupportMessage> findAllByOrderByCreatedAtDesc();

    long countByStatus(String status);
}
