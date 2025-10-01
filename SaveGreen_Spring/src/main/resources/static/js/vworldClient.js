const VWORLD_KEY = "AED66EDE-3B3C-3034-AE11-9DBA47236C69"

export async function getPnuFromLonLat(lon, lat) {
    const url = new URL("https://api.vworld.kr/req/data");
    url.search = new URLSearchParams({
        service : 'data',
        request : 'getFeature',
        data: 'lp_pa_chnd_bubun', // 지번 경계
        size: '1',
        key: VWORLD_KEY,
        geomFilter: `POINT(${lon} ${lat})`,
        geometry: 'false'
}).toString();

const r = await fetch(url);
if (!r.ok) throw new Error('PNU 조회 실패');
const j = await r.json();
const feats = j?.response?.result?.featureCollection?.features;
const props = feats && feats[0]?.properties;
return props?.PNU || props?.pnu || null;
}

export async function getBuildingInfo(pnu) {
    if (!pnu) return null;
    const url = new URL("https://api.vworld.kr/ned/data/getBuildingUse");
    url.search = new URLSearchParams({
        key: VWORLD_KEY,
        format: 'json',
        pnu,
        numOfRows: '1',
    }).toString();

    const r = await fetch(url);
    if (!r.ok) throw new Error('건물정보 조회 실패');
    const j = await r.json();

    // 다양한 응답 스키마 안전 대응
    const items = 
        j?.response?.result?.items ||
        j?.response?.result?.featureCollection?.features ||
        [];
    const first = items[0]?.properties || items[0] || null;
    return first;    
}

export function extractBuiltYear(buildingInfo) {
    const ymd = buildingInfo?.useConfmDe || buildingInfo?.USECFMDE;
    if (!ymd) return null;
    const s = String(ymd);
    return s.length >= 4 ? Number(s.slice(0, 4)) : null;
}