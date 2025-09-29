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


var data = {};
    data.key = "인증키"; /* key */
    data.domain = "도메인"; /* domain */
    data.pnu = "1111017400"; /* 고유번호(8자리 이상) */
    data.mainPrposCode = "02000"; /* 주요용도코드 */
    data.detailPrposCode = "02001"; /* 세부용도코드 */
    data.format = "json"; /* 응답결과 형식(json) */
    data.numOfRows = "10"; /* 검색건수 (최대 1000) */
    data.pageNo = "1"; /* 페이지 번호 */
    
    
    $.ajax({
        type : "get",
        dataType : "jsonp",
        url : "http://api.vworld.kr/ned/data/getBuildingUse",
        data : data,
        async : false,
        success : function(data) {
            console.log(data);

        },
        error : function(xhr, stat, err) {}
    });



//팝업 올리기 구현
function openBookmarkPopup() {
    var name = "iframe_popup";
    var infopop = document.getElementById(name);
    if (infopop == null) {
        infopop = document.createElement("iframe");
        infopop.src = "";
        infopop.style.display = "none";
        infopop.frameBorder = "0";
        infopop.scrolling = "no";

        document.getElementById("vmap").appendChild(infopop);
        infopop.setAttribute("id", name);
        infopop.setAttribute("name", name);
        infopop.frameBorder = "0";
        infopop.scrolling = "no";
        infopop.style.position = "absolute";
        infopop.style.overflow = "hidden";
        infopop.style["background-color"] = "white";
        infopop.style.margin = "auto";
    }

    infopop.style.width = "250px";
    infopop.style.height = "120px";
    infopop.style.left = "5px";
    infopop.style.top = "5px";
    infopop.style.zIndex = 2000; //Z index의 경우 2000이상 설정해야 함
    infopop.setAttribute("src", "https://map.vworld.kr/images/v4map/map/logo.png");

    infopop.style.display = "inline-block";
}
