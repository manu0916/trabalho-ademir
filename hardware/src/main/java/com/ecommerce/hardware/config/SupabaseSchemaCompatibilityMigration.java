package com.ecommerce.hardware.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Removes constraints from the original hardware-only catalog that conflict with store themes. */
@Component
@Profile("supabase")
public class SupabaseSchemaCompatibilityMigration implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(SupabaseSchemaCompatibilityMigration.class);
    private final JdbcTemplate jdbcTemplate;

    public SupabaseSchemaCompatibilityMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("ALTER TABLE public.products "
                + "DROP CONSTRAINT IF EXISTS products_category_check");
        LOG.info("Supabase product category compatibility migration applied.");
    }
}
