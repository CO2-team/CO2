package com.example.co2.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "Api_Cache",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_api_cache_hash",
                columnNames = {"cache_key_hash"}
        )
)
public class ApiCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "Cache_Id")
    private Long id;

    // 기존 FK 컬럼(선택 사용)
    @Column(name = "Guest_IP", length = 45)
    private String guestIp;

    @Column(name = "Building_ID")
    private Long buildingId;

    @Column(name = "Cache_Key_Hash", nullable = false, length = 64)
    private String cacheKeyHash;

    @Column(name = "Cache_Key_Raw", length = 512)
    private String cacheKeyRaw;

    // MySQL 8 JSON 컬럼
    @Lob
    @Column(name = "Payload_Json", nullable = false, columnDefinition = "JSON")
    private String payloadJson;

    @Column(name = "Created_At", nullable = false, insertable = false, updatable = false) // DB default CURRENT_TIMESTAMP
    private LocalDateTime createdAt;

    @Column(name = "Expires_At", nullable = false)
    private LocalDateTime expiresAt;

    // ===== getters/setters =====
    public Long getId() { return id; }
    public String getGuestIp() { return guestIp; }
    public void setGuestIp(String guestIp) { this.guestIp = guestIp; }
    public Long getBuildingId() { return buildingId; }
    public void setBuildingId(Long buildingId) { this.buildingId = buildingId; }
    public String getCacheKeyHash() { return cacheKeyHash; }
    public void setCacheKeyHash(String cacheKeyHash) { this.cacheKeyHash = cacheKeyHash; }
    public String getCacheKeyRaw() { return cacheKeyRaw; }
    public void setCacheKeyRaw(String cacheKeyRaw) { this.cacheKeyRaw = cacheKeyRaw; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}