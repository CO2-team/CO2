package com.example.co2.config;

import com.example.co2.repository.ApiCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class CacheHousekeeping {

    private final ApiCacheRepository repo;

    // 10분마다 만료 캐시 삭제
    @Scheduled(cron = "0 */10 * * * *")
    public void evictExpired() {
        int n = repo.deleteExpired(LocalDateTime.now());
        if (n > 0) log.info("api_cache evicted {} rows", n);
    }

}
