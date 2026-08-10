package com.ecommerce.hardware.config;

import com.ecommerce.hardware.security.ApiRateLimitFilter;
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
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({AdminProperties.class, SecurityProperties.class, MercadoPagoProperties.class})
public class SecurityConfig {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   SecurityProperties securityProperties,
                                                   ApiRateLimitFilter apiRateLimitFilter,
                                                   SecurityContextRepository securityContextRepository,
                                                   CsrfTokenRepository csrfTokenRepository) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        // Spring Security's SPA support accepts the raw value sent from the XSRF cookie.
                        .spa()
                        .csrfTokenRepository(csrfTokenRepository)
                        // The gateway cannot carry a browser CSRF cookie. Its payload is verified server-to-server.
                        // Product writes stay protected by the ADMIN role and the strict CORS allowlist.
                        // They do not depend on a proxy-forwarded CSRF header.
                        .ignoringRequestMatchers("/api/payments/mercado-pago/webhook", "/api/products/**"))
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
                        .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/admin/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/admin/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments/mercado-pago/webhook").permitAll()
                        .requestMatchers("/api/customer/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/products/**").hasRole("ADMIN")
                        .anyRequest().denyAll())
                .addFilterBefore(apiRateLimitFilter, UsernamePasswordAuthenticationFilter.class);

        if (securityProperties.isEnforceHttps()) {
            http.requiresChannel(channel -> channel.anyRequest().requiresSecure());
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
}
