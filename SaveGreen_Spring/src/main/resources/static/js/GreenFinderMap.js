
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
                sessionStorage.setItem("lat", lat);
                sessionStorage.setItem("lon", lon);

            }
        });
    }

    // 모델 객체에 PNU가 있으면 바로 저장
    if (modelObject && modelObject.attributes && modelObject.attributes.PNU) {
        requestParam.pnu = modelObject.attributes.PNU;
        sessionStorage.setItem("pnu", modelObject.attributes.PNU);
        console.log("pnu : ",sessionStorage.getItem('pnu'));
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
        success: function (res) {
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

                    sessionStorage.setItem("pnu", props.pnu);
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
        error: function (err) {
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
        numOfRows: "5"
    };

    $.ajax({
        type: "get",
        dataType: "jsonp",
        url: "http://api.vworld.kr/ned/data/getBuildingUse",
        data: reqData,
        success: function (res) {
            console.log("건물 정보 응답:", res);

            const popup = document.getElementById("popup");

            if (res && res.buildingUses && res.buildingUses.field) {
                const info = res.buildingUses.field[0];

                // 정상 데이터 표시
                $(".popup-footer").show(); // 버튼영역 다시 표시
                $(".info-table").show();   // 테이블 표시
                $("#buildingName").text(info.buldNm || "-");

                $("#buldNm").text(info.buldNm || "-");
                $("#buldDongNm").text(info.buldDongNm || "-");
                $("#ldCodeNm").text(info.ldCodeNm || "-");
                $("#mnnmSlno").text(info.mnnmSlno || "-");
                $("#groundFloorCo").text(info.groundFloorCo || "-");
                $("#undgrndFloorCo").text(info.undgrndFloorCo || "-");
                $("#buldBildngAr").text(info.buldBildngAr || "-");
                $("#buldPlotAr").text(info.buldPlotAr || "-");
                $("#buldHg").text(info.buldHg || "-");
                $("#buldPrposClCodeNm").text(info.buldPrposClCodeNm || "-");
                $("#mainPurpsClCodeNm").text(info.mainPurpsClCodeNm || "-");
                $("#useConfmDe").text(info.useConfmDe || "-");
                $("#detailPrposCodeNm").text(info.detailPrposCodeNm || "-");
                $("#prmisnDe").text(info.prmisnDe || "-");

                showBuildingPopup(info, lastClickPosition);

            } else {
                // 🔸 조회된 건물 정보가 없을 때
                $("#buildingName").text("조회된 건물 정보가 없습니다.");
                $(".info-table").hide();       // 테이블 숨김
                $(".popup-footer").hide();     // 버튼 영역 숨김
            }

        },
        error: function (err) {
            console.error("건물정보 API 호출 실패:", err);
        }
    });
}

// 팝업

function showBuildingPopup(info, windowPosition) {
    // 값 채우기
    $("#buildingName").text(info.buldNm || "-");
    $("#roadAddr").text(info.roadAddr || "-");
    $("#jibunAddr").text(info.jibunAddr || "-");
    $("#engAddr").text(info.engAddr || "-");

    $("#buldNm").text(info.buldNm || "-");
    $("#buldDongNm").text(info.buldDongNm || "-");
    $("#ldCodeNm").text(info.ldCodeNm || "-");
    $("#mnnmSlno").text(info.mnnmSlno || "-");
    $("#groundFloorCo").text(info.groundFloorCo || "-");
    $("#undgrndFloorCo").text(info.undgrndFloorCo || "-");
    $("#buldBildngAr").text(info.buldBildngAr || "-");
    $("#buldPlotAr").text(info.buldPlotAr || "-");
    $("#buldHg").text(info.buldHg || "-");
    $("#buldPrposClCodeNm").text(info.buldPrposClCodeNm || "-");
    $("#mainPurpsClCodeNm").text(info.mainPurpsClCodeNm || "-");
    $("#useConfmDe").text(info.useConfmDe || "-");
    $("#detailPrposCodeNm").text(info.detailPrposCodeNm || "-");
    $("#prmisnDe").text(info.prmisnDe || "-");


    // 위치 잡기
    const popup = document.getElementById("popup");
    popup.style.left = (windowPosition.x + 10) + "px";
    popup.style.top = (windowPosition.y - 10) + "px";
    popup.style.display = "block";

    makePopupDraggable("popup", "popupHeader");
}

//팝업 드래그 기능
function makePopupDraggable(popupId, headerId) {
    const popup = document.getElementById(popupId);
    const header = document.getElementById(headerId);

    let offsetX = 0, offsetY = 0;
    let isDragging = false;

    header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - popup.offsetLeft;
    offsetY = e.clientY - popup.offsetTop;
    header.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    popup.style.left = `${e.clientX - offsetX}px`;
    popup.style.top = `${e.clientY - offsetY}px`;
    popup.style.transform = "none"; // 중앙정렬 해제
    });

    document.addEventListener("mouseup", () => {
    isDragging = false;
    header.style.cursor = "move";
    });

}

function hidePopup() {
    const popup = document.getElementById("popup");
    if (!popup) return;
    popup.style.display = "none";
}



//////////////////////
//검색 -> 화면 이동 -> 팝업
let currentMarker = null; // 기존 마커 제거용 전역 변수 

document.addEventListener("DOMContentLoaded", () => {
    const searchBoxes = document.querySelectorAll(".searchBox");

    searchBoxes.forEach((input) => {
        const resultList = input.parentElement.querySelector(".searchResult");

        input.addEventListener("keyup", function () {
            const keyword = input.value.trim();
            if (keyword.length < 2) {
                resultList.innerHTML = "";
                resultList.classList.remove("show");
                return;
            }

            $.ajax({
                url: "https://api.vworld.kr/req/search",
                type: "GET",
                dataType: "jsonp",
                data: {
                    service: "search",
                    request: "search",
                    version: "2.0",
                    crs: "EPSG:4326",
                    size: 5,
                    page: 1,
                    query: keyword,
                    type: "place", // PLACE 우선
                    format: "json",
                    key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69"
                },
                success: function (data) {
                    resultList.innerHTML = "";
                    const items = data.response?.result?.items || [];

                    if (items.length === 0) {
                        resultList.innerHTML = "<div class='dropdown-item'>검색 결과가 없습니다.</div>";
                        resultList.classList.add("show");
                        return;
                    }

                    const uniqueItems = [];
                    const seenCoords = new Set();

                    items.forEach(item => {
                        const lon = item.point?.x;
                        const lat = item.point?.y;
                        const key = `${lon},${lat}`;
                        if (!seenCoords.has(key)) {
                            seenCoords.add(key);
                            uniqueItems.push(item);
                        }
                    });
                    uniqueItems.forEach((item) => {
                        const name = item.title || item.name || ""; // place 이름
                        const road = item.address?.road || "-";
                        const parcel = item.address?.parcel || "-";
                        const lon = parseFloat(item.point?.x);
                        const lat = parseFloat(item.point?.y);

                        const div = document.createElement("div");
                        div.classList.add("dropdown-item");
                        div.innerHTML = `
                            <b>${name || road || parcel}</b><br>
                            <span style="font-size: 12px; color: gray;">${road !== "-" ? road : parcel}</span>
                        `;

                        div.addEventListener("click", () => {
                             input.value = name || road || parcel;
                            resultList.innerHTML = "";
                            resultList.classList.remove("show");

                            if (lon && lat) {
                                // 지도 이동
                                vwmoveTo(lon, lat, 500);

                                // 기존 마커 제거
                                   if (currentMarker) {
                                        map.removeMarker(currentMarker);
                                        currentMarker = null;
                                    }
                                // 새로운 마커 생성
                                const marker = new vw.geom.Point(new vw.Coord(lon, lat));
                                marker.setImage("https://map.vworld.kr/images/op02/map_point.png");
                                marker.create();
                                currentMarker = marker;

                                // PNU 조회 및 건물 정보 저장
                                getPnuFromCoord(lon, lat)
                                    .then((pnu) => {
                                        if (!pnu) throw new Error("PNU를 찾을 수 없습니다.");
                                        $("#pnu").val(pnu);
                                        return getBuildingInfo(pnu);
                                    })
                                    .then(info => {
                                        sessionStorage.setItem("ldCodeNm", info.ldCodeNm || '');
                                        sessionStorage.setItem("mnnmSlno", info.mnnmSlno || '');
                                        sessionStorage.setItem("BuildingArea", info.buldBildngAr || '');
                                        sessionStorage.setItem("buildingName", info.buldNm || '');
                                        sessionStorage.setItem("useConfmDe", info.useConfmDe || '');
                                        sessionStorage.setItem("builtYear", String(info.useConfmDe || '').slice(0, 4));
                                        sessionStorage.setItem("jibunAddr", (info.ldCodeNm || '') + ' ' + (info.mnnmSlno || ''));
                                    })
                                    .catch((err) => {
                                        console.warn("검색 기반 PNU 조회 실패:", err);
                                        alert("건물 정보를 불러올 수 없습니다.");
                                    });
                            } else {
                                alert("좌표 정보가 없습니다.");
                            }
                        });

                        resultList.appendChild(div);
                    });

                    resultList.classList.add("show");
                },
                error: function (err) {
                    console.error("주소 검색 오류:", err);
                }
            });
        });
    });
});


function showPopup(html, windowPosition) {
    const popup = document.getElementById("popup");
    if (popup.style.display === "block") return;
    const posX = windowPosition?.x ?? window.innerWidth / 2;
    const posY = windowPosition?.y ?? window.innerHeight / 2;

    popup.style.left = (posX + 10) + "px";
    popup.style.top = (posY - 10) + "px";
    popup.innerHTML = html;
    popup.style.display = "block";
}


//////////////////////////////
//지도 이동
//////////////////////////////

function vwmoveTo(x, y, z) {
    var movePo = new vw.CoordZ(x, y, z);
    var mPosi = new vw.CameraPosition(movePo, new vw.Direction(0, -80, 0));
    map.moveTo(mPosi);
}

function checkE(){
    
    dummyDataEnergy();
}

function dummyDataEnergy(){
    // 숨겨진 input에서 pnu 값 가져오기
    const pnu = document.getElementById("pnu").value;
    console.log("받은 PNU:", pnu);

    if (!pnu) {
        alert("PNU 값이 없습니다. 건물을 선택해주세요.");
        return;
    }

    // Spring Controller로 GET 요청 보내기
    fetch(`/GreenFinder/energyCheck/${pnu}`)
        .then(response => {
            if (!response.ok) {
                throw new Error("데이터 없음");
            }
            return response.json();
        })
        .then(data => {
            console.log("서버에서 받은 데이터:", data);
            location.href="/GreenFinder/energyCheck";
            window.location.href = `/GreenFinder/energyCheck?pnu=${pnu}`;
        })
        .catch(error => {
            console.error(error);
            alert("해당 건물의 에너지 데이터가 없습니다.");
            //location.href="/GreenFinder";
        });
}

//팝업창 
$(document).ready(function () {
    // 쿠키 확인
    var popup1 = getCookie('popup1');

    // 쿠키가 없을 때만 팝업 노출
    if (!popup1) {
        popUpAction('popup1');
    }

    // 닫기 버튼 클릭 이벤트
    $('.btn_close').click(function (e) {
        e.preventDefault();

        const name = $(this).data('popup'); // 팝업 이름 가져오기
        const popupDiv = $("div[name=" + name + "]");

        // 팝업 닫기
        popupDiv.fadeOut();
         $('.popup-overlay').fadeOut();
        // 오늘 하루 보지 않기 체크 시 쿠키 설정
        if (popupDiv.find("input[name=today_close1]").is(":checked")) {
            setCookie00(name, "done", 1);
        }
    });
});

// ======================= 쿠키 관련 함수 =======================

function getCookie(name) {
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
        if (cookie.startsWith(name + '=')) {
            return cookie.substring(name.length + 1);
        }
    }
    return "";
}

// 00:00 기준으로 쿠키 설정
function setCookie00(name, value, expiredays) {
    var todayDate = new Date();
    todayDate = new Date(parseInt(todayDate.getTime() / 86400000) * 86400000 + 54000000);

    if (todayDate > new Date()) {
        expiredays = expiredays - 1;
    }

    todayDate.setDate(todayDate.getDate() + expiredays);

    document.cookie = `${name}=${escape(value)}; path=/; expires=${todayDate.toGMTString()};`;
}

// 팝업 보이기
function popUpAction(name) {
    $('.popup-overlay').fadeIn();
    $("div[name=" + name + "]").fadeIn();
}

function remodelong_move(){
    window.location.href = '/forecast';
}

function simulater_move(){
    window.location.href = '/simulator';
}
