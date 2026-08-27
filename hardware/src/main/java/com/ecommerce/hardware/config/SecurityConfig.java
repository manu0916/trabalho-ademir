package com.ecommerce.hardware.config;

import com.ecommerce.hardware.security.ApiRateLimitFilter;
import com.ecommerce.hardware.security.AdminAccessTokenService;
import com.ecommerce.hardware.security.AdminBearerAuthenticationFilter;
import com.ecommerce.hardware.security.StripeWebhookBodyLimitFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({AdminProperties.class, SecurityProperties.class, StripeProperties.class, StoreProperties.class})
public class SecurityConfig {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   SecurityProperties securityProperties,
                                                   AdminAccessTokenService adminAccessTokenService,
                                                   SecurityContextRepository securityContextRepository,
                                                   CsrfTokenRepository csrfTokenRepository) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        // Spring Security's SPA support accepts the raw value sent from the XSRF cookie.
                        .spa()
                        .csrfTokenRepository(csrfTokenRepository)
                        // Bearer-authenticated admin writes do not rely on an ambient browser credential,
                        // so CSRF is unnecessary for their narrowly matched mutation endpoints.
                        // Anonymous support/stock submissions also carry no authenticated user state.
                        // The extension token exchange is stateless and authenticates explicit credentials;
                        // the cookie/session-based web login remains CSRF protected.
                        .ignoringRequestMatchers("/api/payments/stripe/webhook", "/api/admin/auth/token",
                                "/api/products/**",
                                "/api/storefront/hero/**", "/api/storefront/footer/**", "/api/admin/orders/**")
                        .ignoringRequestMatchers(SecurityConfig::isPublicSubmission,
                                SecurityConfig::isAdminBearerMutation))
                .securityContext(context -> context
                        .securityContextRepository(securityContextRepository)
                        .requireExplicitSave(true))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(fixation -> fixation.changeSessionId()))
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"))
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(Customizer.withDefaults())
                        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .crossOriginOpenerPolicy(coop -> coop.policy(org.springframework.security.web.header.writers.CrossOriginOpenerPolicyHeaderWriter.CrossOriginOpenerPolicy.SAME_ORIGIN))
                        .crossOriginResourcePolicy(corp -> corp.policy(org.springframework.security.web.header.writers.CrossOriginResourcePolicyHeaderWriter.CrossOriginResourcePolicy.SAME_ORIGIN))
                        .permissionsPolicyHeader(policy -> policy.policy(
                                "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()"))
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000)))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> writeJsonError(response,
                                HttpServletResponse.SC_UNAUTHORIZED, "Autenticacao necessaria."))
                        .accessDeniedHandler((request, response, exception) -> {
                            LOG.warn("Access denied: method={} path={} reason={}",
                                    request.getMethod(), request.getRequestURI(), exception.getClass().getSimpleName());
                            response.setHeader("X-Nexus-Access-Denied-Reason", exception.getClass().getSimpleName());
                            writeJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Acesso negado.");
                        }))
                .logout(logout -> logout
                        .logoutUrl("/api/admin/auth/logout")
                        .logoutSuccessHandler((request, response, authentication) -> response
                                .setStatus(HttpServletResponse.SC_NO_CONTENT))
                        .invalidateHttpSession(true)
                        .clearAuthentication(true))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                        // Spring's internal error dispatch must remain reachable; public error
                        // details are already disabled in application.properties.
                        .requestMatchers("/error").permitAll()
                        // Match this endpoint from the raw servlet URI before any MVC matcher can
                        // claim it. AdminBearerAuthenticationFilter already blocks every mutating
                        // method unless its signed Bearer is valid.
                        .requestMatchers(SecurityConfig::isProductEndpoint).permitAll()
                        // The hero and its image bytes are public reads. Its mutating methods are
                        // rejected by AdminBearerAuthenticationFilter before MVC parses a body.
                        .requestMatchers(SecurityConfig::isStorefrontHeroEndpoint).permitAll()
                        .requestMatchers(SecurityConfig::isStorefrontFooterEndpoint).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/payments/methods").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/admin/auth/csrf").permitAll()
                        // Anonymous checks return 204 instead of polluting the browser console with
                        // an expected 401. The controller only issues a token to ROLE_ADMIN.
                        .requestMatchers(HttpMethod.GET, "/api/admin/auth/session").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/admin/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/admin/auth/token").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments/stripe/webhook").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reviews/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/support/messages").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/coupons/validate").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/stock-alerts").permitAll()
                        .requestMatchers("/api/customer/**").permitAll()
                        .requestMatchers(SecurityConfig::isAdminBearerMutation)
                                .hasAuthority("ROLE_ADMIN_BEARER")
                        .requestMatchers(HttpMethod.POST, "/api/admin/orders/**")
                                .hasAuthority("ROLE_ADMIN_BEARER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().denyAll())
                .addFilterAfter(new ApiRateLimitFilter(securityProperties), SecurityContextHolderFilter.class)
                // Rate-limit first, then bounded-buffer at most MAX+1 bytes before MVC can
                // materialize a chunked/unknown-length Stripe webhook request body.
                .addFilterAfter(new StripeWebhookBodyLimitFilter(), ApiRateLimitFilter.class)
                // Run after the session context is loaded and before anonymous/authorization.
                // The filter is deliberately not a servlet @Component, preventing double execution.
                .addFilterAfter(new AdminBearerAuthenticationFilter(adminAccessTokenService),
                        StripeWebhookBodyLimitFilter.class);

        if (securityProperties.isEnforceHttps()) {
            // requiresChannel is a legacy DSL whose Spring Security 7.1 implementation still
            // references removed channel classes. redirectToHttps uses the supported transport
            // filter and honors the scheme already normalized by the trusted Render proxy.
            http.redirectToHttps(Customizer.withDefaults());
        }

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * The admin is authenticated by AdminAuthenticator. Defining this bean prevents Spring Boot
     * from creating and logging an unused development password.
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("No password-based user service is configured.");
        };
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public CsrfTokenRepository csrfTokenRepository(@Value("${app.cookies.cross-site:false}") boolean crossSiteCookies) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        if (crossSiteCookies) {
            repository.setCookieCustomizer(cookie -> cookie.sameSite("None").secure(true));
        }
        return repository;
    }

    private void writeJsonError(HttpServletResponse response, int status, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }

    private static boolean isProductEndpoint(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "/api/products".equals(path) || path.startsWith("/api/products/");
    }

    private static boolean isStorefrontHeroEndpoint(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "/api/storefront/hero".equals(path) || path.startsWith("/api/storefront/hero/");
    }

    private static boolean isStorefrontFooterEndpoint(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "/api/storefront/footer".equals(path) || path.startsWith("/api/storefront/footer/");
    }

    private static boolean isPublicSubmission(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return false;
        String path = request.getRequestURI();
        return "/api/support/messages".equals(path) || "/api/stock-alerts".equals(path);
    }

    private static boolean isAdminBearerMutation(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        if ("POST".equalsIgnoreCase(method)) {
            return "/api/admin/coupons".equals(path);
        }
        if ("PATCH".equalsIgnoreCase(method)) {
            return path.startsWith("/api/admin/coupons/")
                    || path.startsWith("/api/admin/support/messages/")
                    || path.startsWith("/api/admin/stock-alerts/");
        }
        return "DELETE".equalsIgnoreCase(method) && path.startsWith("/api/admin/coupons/");
    }

}
