
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('simulatorForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        const resp = await fetch('/simulate', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();

        const box = document.getElementById('resultBox');
        if (!box) return;

        const items = box.querySelectorAll('.result-item');
        items.forEach(item => item.classList.remove('show'));

        document.getElementById('propertyTax').textContent = data.propertyTax ?? '-';
        document.getElementById('acquireTax').textContent  = data.acquireTax ?? '-';
        document.getElementById('areaBonus').textContent   = data.areaBonus ?? '-';
        document.getElementById('grade').textContent       = data.grade ?? '-';
        document.getElementById('category').textContent    = data.category ?? '-';
        document.getElementById('energySelf').textContent = data.energySelf ?? '-';
        document.getElementById('certificationDiscount').textContent = data.certificationDiscount ?? '-';
        document.getElementById('renewableSupport').textContent = data.renewableSupport ?? '-';
        document.getElementById('zebGrade').textContent = data.zebGrade ?? '-';   

        box.style.display = 'block';

      
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300);
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const lat = localStorage.getItem("lat");
    const lon = localStorage.getItem("lon");
    if (lat && lon) {
        document.querySelector("#lat").value = lat;
        document.querySelector("#lon").value = lon;
    }
});


document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("searchBox");
    const resultList = document.getElementById("searchResult");

  
    input.addEventListener("keyup", async () => {
        const keyword = input.value.trim();
        if (keyword.length < 2) {
          resultList.innerHTML = "";
          resultList.classList.remove("show");
          return;
        }

        try {
          const resp = await fetch(`/search?keyword=${encodeURIComponent(keyword)}`);
          const list = await resp.json();

          resultList.innerHTML = "";
          list.forEach(addr => {
            const item = document.createElement("div");
            item.classList.add("dropdown-item");
            item.textContent = addr.roadAddr; // 화면에 표시할 주소

            // 🔹 클릭 이벤트 (주소 선택)
            item.addEventListener("click", async () => {
              input.value = addr.roadAddr; // 입력창에 선택 주소 넣기
              resultList.innerHTML = "";
              resultList.classList.remove("show");

              // hidden input 채우기
              document.getElementById("roadAddr").value = addr.roadAddr;
              document.getElementById("jibunAddr").value = addr.jibunAddr;
              document.getElementById("zipNo").value = addr.zipNo;

          
              const geoResp = await fetch(
                `http://api.vworld.kr/req/address?service=address
                &request=getcoord
                &version=2.0
                &crs=epsg:4326
                &address=${encodeURIComponent(addr.roadAddr)}
                &format=json
                &type=road
                &key=AED66EDE-3B3C-3034-AE11-9DBA47236C69`
              );
              const geoData = await geoResp.json();
              if (geoData.response && geoData.response.result && geoData.response.result.point) {
                const lon = geoData.response.result.point.x;
                const lat = geoData.response.result.point.y;

                document.getElementById("lat").value = lat;
                document.getElementById("lon").value = lon;

                console.log("선택된 주소:", addr.roadAddr, "좌표:", lat, lon);
              } else {
                console.warn("지오코딩 실패:", geoData);
              }
            });

          resultList.appendChild(item);
        });

        if (list.length > 0) {
          resultList.classList.add("show");
        } else {
          resultList.classList.remove("show");
        }
      } catch (err) {
        console.error("주소 검색 오류:", err);
      }
    });
});
