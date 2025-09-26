package com.example.co2.repository;

import com.example.co2.entity.ApiCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface ApiCacheRepository extends JpaRepository<ApiCache, Long> {
    Optional<ApiCache> findTopByCacheKeyHashAndExpiresAtAfter(String cacheKeyHash, LocalDateTime now);
    long deleteByExpiresAtBefore(LocalDateTime now);
}
