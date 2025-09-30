//우주에서 보는 지구 시점
//homePosition ||  지구본
var hX = 127.425;
var hY = 38.196;
var hZ = 13487000;
var hH = 0;
var hT = -80;
var hR = 0;

//페이지 초기화시 지도의 카메라 시점이 미래융합
//initPosition ||  미래융합
var sX = 127.3821894;
var sY = 36.3484686
var sZ = 1000;
var sH = 0;
var sT = -60;
var sR = 0;

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

setTimeout(
    function() {
        map.onClick.addEventListener(buildingInfoEvent);
    },
    100);
var buildingInfoEvent = function(windowPosition, ecefPosition, cartographic, modelObject) {
    if (modelObject) {
        var mapElement = modelObject.element;
        var attributes = modelObject.attributes;

        if (attributes && mapElement) {
            mapElement.highlightFeatureByKey(attributes);
            buildingId.value = attributes.MODEL_NAME;
            buildingType.value = mapElement.elementType;
            buildingLayerName.value = mapElement.id;
        }
    }
};

function $id(id) {
    return document.getElementById(id);
}

var requestParam = {
    lon: null,
    lat: null,
    height: null,
    pnu: null
};

// 건물 클릭 이벤트
var buildingInfoEvent = function(windowPosition, ecefPosition, cartographic, modelObject) {
    if (cartographic) {
        var lon = cartographic.longitude * (180 / Math.PI); 
        var lat = cartographic.latitude * (180 / Math.PI);
        var height = cartographic.height;

        requestParam.lon = lon;
        requestParam.lat = lat;
        requestParam.height = height;

        console.log("클릭 좌표 저장됨:", requestParam);

        // PNU 변환 호출
        getPnuFromCoord(lon, lat);
    }

    if (modelObject) {
        var attributes = modelObject.attributes;
        if (attributes && attributes.PNU) {
            requestParam.pnu = attributes.PNU; // 만약 바로 제공된다면 저장
            console.log("건물 PNU 저장됨:", requestParam.pnu);
        }
    }
};

// 건물 정보 조회 함수
function getBuildingInfo(pnu) {
    var reqData = {
        key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69", // 브이월드 발급 API KEY
        pnu: pnu,                                   // 클릭한 건물의 PNU
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
                var info = res.buildingUses.field[0];

                var html = `
                    <b>건물명:</b> ${info.buldNm || "-"}<br>
                    <b>건물동명:</b> ${info.buldDongNm || "-"}<br>
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

                // 🔑 팝업 표시
                showPopup(lastClickPosition, html);
            } else {
                showPopup(lastClickPosition, "조회된 건물 정보가 없습니다.");
            }
        },
        error: function(xhr, stat, err) {
            console.error("건물정보 API 호출 실패:", err);
        }
    });
}

//선택한 좌표 저장
var lastClickPosition = null;

var buildingInfoEvent = function(windowPosition, ecefPosition, cartographic, modelObject) {
    lastClickPosition = windowPosition;  // 팝업 위치 저장

    if (cartographic) {
        var lon = cartographic.longitude * (180 / Math.PI);
        var lat = cartographic.latitude * (180 / Math.PI);
        getPnuFromCoord(lon, lat);
    }
};


function getPnuFromCoord(lon, lat) {
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
            geomFilter: "POINT(" + lon + " " + lat + ")"
        },
        success: function(res) {
            try {
                var features = res.response.result.featureCollection.features;
                if (features.length > 0) {
                    var pnu = features[0].properties.pnu;

                    requestParam.pnu = pnu;
                    console.log("조회된 PNU 저장됨:", requestParam);

                    getBuildingInfo(pnu);
                } else {
                    console.warn("해당 좌표에서 PNU를 찾을 수 없습니다.");
                }
            } catch (e) {
                console.error("PNU 조회 실패", e);
            }
        },
        error: function(xhr, stat, err) {
            console.error("PNU API 호출 오류:", err);
        }
    });
}


//선택한 건물 정보 팝업
function showPopup(windowPosition, html) {
    var popup = document.getElementById("popup");
    popup.style.left = (windowPosition.x + 10) + "px";  // 클릭 위치 옆에 표시
    popup.style.top = (windowPosition.y - 10) + "px";
    popup.innerHTML = html;
    popup.style.display = "block";
}

function hidePopup() {
    document.getElementById("popup").style.display = "none";
}
