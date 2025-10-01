
// 초기 카메라/지도 설정

// 우주에서 보는 지구 시점
var hX = 127.425, hY = 38.196, hZ = 13487000;
var hH = 0, hT = -80, hR = 0;

// 페이지 초기화 시 미래융합 위치
var sX = 127.3821894, sY = 36.3484686, sZ = 1000;
var sH = 0, sT = -60, sR = 0;

var options = {
    mapId: "vmap",
    initPosition: new vw.CameraPosition(
        new vw.CoordZ(sX, sY, sZ),
        new vw.Direction(sH, sT, sR)
    ),
    logo: true,
    navigation: true
};

var map = new vw.Map();
map.setOption(options);
map.start();

// 클릭 이벤트 연결
setTimeout(() => {
    map.onClick.addEventListener(buildingInfoEvent);
}, 100);


// 전역 변수
var lastClickPosition = { x: 0, y: 0 };
var requestParam = {
    lon: null,
    lat: null,
    height: null,
    pnu: null,
    ldCodeNm: null,
    mnnmSlno: null
};

// ==========================
// DOM 조회 함수
// ==========================
function $id(id) {
    return document.getElementById(id);
}


// 건물 클릭 이벤트
function buildingInfoEvent(windowPosition, ecefPosition, cartographic, modelObject) {
    if (windowPosition) {
        lastClickPosition = windowPosition;
    }

    if (cartographic) {
    const lon = cartographic.longitude * (180 / Math.PI);
    const lat = cartographic.latitude * (180 / Math.PI);
    const height = cartographic.height;

    requestParam.lon = lon;
    requestParam.lat = lat;
    requestParam.height = height;

    $("#lon").val(lon);
    $("#lat").val(lat);
    $("#height").val(height);

    // 반드시 AJAX 끝난 뒤 건물 정보 조회
    getPnuFromCoord(lon, lat, (pnu) => {
        if (pnu) {
            console.log("hidden input 확인:", {
                pnu: $("#pnu").val(),
               
            });

            getBuildingInfo(pnu);

            // service.js (지도 클릭 시)
            localStorage.setItem("lat", lat);
            localStorage.setItem("lon", lon);

        }
    });
}

    // 모델 객체에 PNU가 있으면 바로 저장
    if (modelObject && modelObject.attributes && modelObject.attributes.PNU) {
        requestParam.pnu = modelObject.attributes.PNU;
        $("#pnu").val(modelObject.attributes.PNU);
    }
}

// PNU 조회
function getPnuFromCoord(lon, lat, callback) {
    $.ajax({
        type: "get",
        dataType: "jsonp",
        url: "https://api.vworld.kr/req/data",
        data: {
            service: "data",
            request: "getfeature",
            data: "lp_pa_cbnd_bubun",
            key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69",
            format: "json",
            geomFilter: `POINT(${lon} ${lat})`
        },
        success: function(res) {
            try {
                const features = res.response.result.featureCollection.features;
                if (features.length > 0) {
                    const props = features[0].properties;

                    // requestParam 채우기
                    requestParam.pnu = props.pnu ?? "";
                    requestParam.ldCodeNm = props.ldCodeNm ?? "";
                    requestParam.mnnmSlno = props.mnnmSlno ?? "";

                    // hidden input 채우기
                    $("#pnu").val(requestParam.pnu);
                    

                    console.log("PNU/ldCodeNm/mnnmSlno 채워짐:", requestParam);

                    // callback 호출
                    if (callback) callback(requestParam.pnu);
                } else {
                    console.warn("해당 좌표에서 PNU를 찾을 수 없습니다.");
                    if (callback) callback(null);
                }
            } catch (e) {
                console.error("PNU 조회 실패", e);
                if (callback) callback(null);
            }
        },
        error: function(err) {
            console.error("PNU API 호출 오류:", err);
            if (callback) callback(null);
        }
    });
}


// 건물 정보 조회
function getBuildingInfo(pnu) {
    const reqData = {
        key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69",
        pnu: pnu,
        format: "json",
        numOfRows: "10"
    };

    $.ajax({
        type: "get",
        dataType: "jsonp",
        url: "http://api.vworld.kr/ned/data/getBuildingUse",
        data: reqData,
        success: function(res) {
            console.log("건물 정보 응답:", res);

            if (res && res.buildingUses && res.buildingUses.field) {
                const info = res.buildingUses.field[0];
                const html = `
                    <b>건물명:</b> ${info.buldNm || "-"}<br>
                    <b>건물동명:</b> ${info.buldDongNm || "-"}<br>
                    <b>법정동명:</b> ${info.ldCodeNm || "-"}<br>
                    <b>지번:</b> ${info.mnnmSlno || "-"}<br>
                    <b>식별번호:</b> ${info.buldIdntfcNo || "-"}<br>
                    <b>건축면적:</b> ${info.buldBildngAr || "-"}㎡<br>
                    <b>대지면적:</b> ${info.buldPlotAr || "-"}㎡<br>
                    <b>사용승인일:</b> ${info.useConfmDe || "-"}<br>
                    <b>지상층수:</b> ${info.groundFloorCo || "-"}<br>
                    <b>지하층수:</b> ${info.undgrndFloorCo || "-"}<br>
                    <b>건물높이:</b> ${info.buldHg || "-"}m<br>
                    <b>용도:</b> ${info.buldPrposClCodeNm || "-"}
                `;
                showPopup(lastClickPosition, html);
                requestParam.ldCodeNm = info.ldCodeNm ?? "";
                requestParam.mnnmSlno = info.mnnmSlno ?? "";
                $("#ldCodeNm").val(info.ldCodeNm);
                $("#mnnmSlno").val(info.mnnmSlno);

                localStorage.setItem("ldCodeNm", info.ldCodeNm);
                localStorage.setItem("mnnmSlno", info.mnnmSlno);
                localStorage.setItem("BuildingArea", info.buldBildngAr);

            } else {
                showPopup(lastClickPosition, "조회된 건물 정보가 없습니다.");
            }
        },
        error: function(err) {
            console.error("건물정보 API 호출 실패:", err);
        }
    });
}


// 팝업
function showPopup(windowPosition, html) {
    const popup = $id("popup");
    popup.style.left = (windowPosition.x + 10) + "px";
    popup.style.top = (windowPosition.y - 10) + "px";
    popup.innerHTML = html;
    popup.style.display = "block"; 
}

function hidePopup() {
    $id("popup").style.display = "none";
}
