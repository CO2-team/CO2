package com.example.co2.repository;

import com.example.co2.entity.ApiCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ApiCacheRepository extends JpaRepository<ApiCache, Long> {

    /* 캐시 조회(유효기간 내) */
    Optional<ApiCache> findTopByCacheKeyHashAndExpiresAtAfter(String cacheKeyHash, LocalDateTime now);

    /* 만료 캐시 벌크 삭제: JPQL로 명시, 삭제 행 수 반환 */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ApiCache c where c.expiresAt < :cutoff")
    int deleteExpired(@Param("cutoff") LocalDateTime cutoff);

    /* ======================
     * MySQL Native UPSERT
     *  - cache_key_hash 에 UNIQUE 인덱스 전제
     *  - 충돌 시 지정 컬럼 갱신
     *  - 반환값: 영향받은 행 수
     * ====================== */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
		INSERT INTO api_cache
		  (cache_key_hash, cache_key_raw, payload_json, expires_at, building_id, guest_ip)
		VALUES
		  (:hash, :raw, :payload, :expiresAt, :buildingId, :guestIp)
		ON DUPLICATE KEY UPDATE
		  cache_key_raw = VALUES(cache_key_raw),
		  payload_json  = VALUES(payload_json),
		  expires_at    = VALUES(expires_at),
		  building_id   = VALUES(building_id),
		  guest_ip      = VALUES(guest_ip)
		""", nativeQuery = true)
    int upsert(@Param("hash") String hash,
               @Param("raw") String raw,
               @Param("payload") String payload,
               @Param("expiresAt") LocalDateTime expiresAt,
               @Param("buildingId") Long buildingId,
               @Param("guestIp") String guestIp);
}
