//에너지 등급 시뮬레이터
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('simulatorForm1');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        const resp = await fetch('/simulate1', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();

        const box = document.getElementById('resultBox');
        if (!box) return;

        const items = box.querySelectorAll('.result-item');
        items.forEach(item => item.classList.remove('show'));

        document.getElementById('propertyTax').textContent = (data.propertyTax ?? '-')+"%";
        document.getElementById('acquireTax').textContent  = (data.acquireTax ?? '-')+"%";
        document.getElementById('areaBonus').textContent   = (data.areaBonus ?? '-')+"%";
        document.getElementById('grade').textContent       = data.grade ?? '-';
        document.getElementById('category').textContent    = data.category ?? '-';
        document.getElementById('energySelf').textContent = (data.energySelf ?? '-')+"%";
        document.getElementById('certificationDiscount').textContent = (data.certificationDiscount ?? '-')+"%";
        document.getElementById('renewableSupport').textContent = data.renewableSupport ?? '-';
        document.getElementById('zebGrade').textContent = data.zebGrade ?? '-';   

        box.style.display = 'block';

      
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300);
        });
    });
});
//태양광 시뮬레이터
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('simulatorForm2');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        const resp = await fetch('/simulate2', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();

        const box = document.getElementById('resultBox2');
        if (!box) return;

        const items = box.querySelectorAll('.result-item');
        items.forEach(item => item.classList.remove('show'));

        
        document.getElementById('annualSaveElectric').textContent  = (data.annualSaveElectric ?? '-')+" kWh";
        document.getElementById('annualSaveCO2').textContent   = (data.annualSaveCO2 ?? '-')+" 톤 CO2";
        document.getElementById('total').textContent       = (data.total ?? '-')+"만 원";
        document.getElementById('requiredPanels').textContent    = (data.requiredPanels ?? '-')+" 개";

       
        box.style.display = 'block';

      
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300);
        });
    });
});

// 빌딩에어리어 가져오기
document.addEventListener("DOMContentLoaded", () => {
    const area = sessionStorage.getItem("BuildingArea");
    console.log("로컬스토리지에서 가져온 건물면적:", area);
    if (area) {
        document.getElementById("area1").value = area;
        document.getElementById("area2").value = area;
    }
});

// 위도경도가져오기
document.addEventListener("DOMContentLoaded", () => {
    const lat = sessionStorage.getItem("lat");
    const lon = sessionStorage.getItem("lon");
    console.log("로컬스토리지에서 가져온 좌표:", lat, lon);
    if (lat && lon) {
        document.querySelector("#lat1").value = lat;
        document.querySelector("#lon1").value = lon;

        document.querySelector("#lat2").value = lat;
        document.querySelector("#lon2").value = lon;
    }
});

// 주소가져오기
document.addEventListener("DOMContentLoaded", () => {
    const ldCodeNm = sessionStorage.getItem("ldCodeNm");
    const mnnmSlno = sessionStorage.getItem("mnnmSlno");
    console.log("세션스토리지에서 가져온 주소:", ldCodeNm, mnnmSlno);
    if (ldCodeNm && mnnmSlno) {
        const combined = ldCodeNm+" "+mnnmSlno;
        document.getElementById("juso1").value = combined;
        document.getElementById("juso2").value = combined; 
    }
});

document.addEventListener("DOMContentLoaded", () => {
  const searchBoxes = document.querySelectorAll(".searchBox");

  searchBoxes.forEach((input) => {
    const resultList = input.parentElement.querySelector(".searchResult");

    input.addEventListener("keyup", async () => {
      const keyword = input.value.trim();
      if (keyword.length < 2) {
        resultList.innerHTML = "";
        resultList.classList.remove("show");
        return;
      }

      const resp = await fetch(`/search?keyword=${encodeURIComponent(keyword)}`);
      const list = await resp.json();

      resultList.innerHTML = "";
      list.forEach(addr => {
        const item = document.createElement("div");
        item.classList.add("dropdown-item");
        item.textContent = addr.roadAddr;

        item.addEventListener("click", () => {
          input.value = addr.roadAddr;
          resultList.innerHTML = "";
          resultList.classList.remove("show");
          // 주소->좌표 변환 AJAX
          $.ajax({
            url: "http://api.vworld.kr/req/address",
            type: "GET",
            dataType: "jsonp",   
            data: {
              service: "address",
              request: "getcoord",
              version: "2.0",
              crs: "epsg:4326",
              address: addr.roadAddr,   
              format: "json",
              type: "road",
              key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69"  
            },
            success: function(data) {
              if (data && data.response && data.response.result && data.response.result.point) {
                const lon = data.response.result.point.x;
                const lat = data.response.result.point.y;

                const currentForm = input.closest("form");
                $(currentForm).find("input[name='lon']").val(lon);
                $(currentForm).find("input[name='lat']").val(lat);

                console.log("선택된 주소:", addr.roadAddr, "→ 좌표:", lat, lon);


                // 좌표 -> pnu
                $.ajax({
                  url: "http://api.vworld.kr/req/data",
                  type: "GET",
                  dataType: "jsonp",
                  data: {
                    service: "data",
                    request: "getfeature",
                    data: "lp_pa_cbnd_bubun",
                    format: "json",
                    geomFilter: `POINT(${lon} ${lat})`,
                    crs: "EPSG:4326",
                    key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69"
                  },
                  success: function (pnuData) {
                    const pnu = pnuData?.response?.result?.featureCollection?.features?.[0]?.properties?.pnu;
                    if (!pnu) {
                      console.warn("PNU 조회 실패:", pnuData);
                      return;
                    }
                    console.log("PNU:", pnu);

                    // pnu로 건물면적조회
                    $.ajax({
                      url: "http://api.vworld.kr/ned/data/getBuildingUse",
                      type: "GET",
                      dataType: "jsonp",
                      data: {
                        key: "AED66EDE-3B3C-3034-AE11-9DBA47236C69",
                        pnu: pnu,
                        format: "json"
                      },
                      success: function (buildData) {
                        const area = buildData?.buildingUses?.field?.[0]?.buldBildngAr;
                        if (area) {
                          $(currentForm).find("input[name='area']").val(area);

                          console.log("건물면적:", area);
                        } else {
                          console.warn("면적 정보 없음:", buildData);
                        }
                      },
                      error: function (xhr, status, error) {
                        console.error("건물정보 API 오류:", error);
                      }
                    });
                  },
                  error: function (xhr, status, error) {
                    console.error("PNU API 오류:", error);
                  }
                });
              } else {
                console.warn("지오코딩 결과 없음:", data);
              }
            },
            error: function(err) {
              console.error("지오코딩 API 호출 실패:", err);
            }
          });
        });

        resultList.appendChild(item);
      });

      if (list.length > 0) {
        resultList.classList.add("show");
      } else {
        resultList.classList.remove("show");
      }
    });
  });
});



// document.addEventListener("DOMContentLoaded", () => {
//     const current = document.getElementById("currentGrade");
//     const target = document.getElementById("targetGrade");

//     const allOptions = Array.from(target.options);

//     current.addEventListener("change", () => {
//         const currentVal = parseInt(current.value, 10);
//         target.innerHTML = "";
//         allOptions.forEach(opt => {
//             if (parseInt(opt.value, 10) < currentVal) {
//                 target.appendChild(opt.cloneNode(true));
//             }
//         });
//     });
// });


// 주소검색을 위한 js
 
// document.addEventListener("DOMContentLoaded", () => {
//   const searchBoxes = document.querySelectorAll(".searchBox");

//   searchBoxes.forEach((input, idx) => {
//     const resultList = input.parentElement.querySelector(".searchResult");

//     input.addEventListener("keyup", async () => {
//       const keyword = input.value.trim();
//       if (keyword.length < 2) {
//         resultList.innerHTML = "";
//         resultList.classList.remove("show");
//         return;
//       }

//       const resp = await fetch(`/search?keyword=${encodeURIComponent(keyword)}`);
//       const list = await resp.json();

//       resultList.innerHTML = "";
//       list.forEach(addr => {
//         const item = document.createElement("div");
//         item.classList.add("dropdown-item");
//         item.textContent = addr.roadAddr;

//         item.addEventListener("click", () => {
//           input.value = addr.roadAddr;
//           resultList.innerHTML = "";
//           resultList.classList.remove("show");
//         });

//         resultList.appendChild(item);
//       });

//       if (list.length > 0) {
//         resultList.classList.add("show");
//       } else {
//         resultList.classList.remove("show");
//       }
//     });
//   });
// });
