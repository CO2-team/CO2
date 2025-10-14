// 시뮬레이터 사용법 안내
document.addEventListener("DOMContentLoaded", () => {
Swal.fire({
    title: '시뮬레이터 사용법',
    html: '<h4>에너지 등급 시뮬레이터</h4>'
         +'<b>1.</b>지도 클릭(서비스) 혹은 주소검색으로 주소,면적 입력하기<br>'
         +'<b>2.</b>태양광 패널 갯수,정격출력 입력하기<br>'
         +'<b>3.</b> 결과확인 버튼 누르기<br>'
         +'<h4>태양광 에너지 효율 경제성 시뮬레이터</h4>'
         +'<b>1.</b>지도 클릭(서비스) 혹은 주소검색으로 주소,면적 입력하기<br>'
         +'<b>2.</b>현재 등급,목표 등급 선택하기<br>'
         +'<b>3.</b>태양광 패널 정격출력 입력하기<br>'
         +'<b>4.</b> 결과확인 버튼 누르기<br>',
    icon: 'info',
    confirmButtonText: '확인'
  });
  // 시뮬레이터 결과 가이드
  const guideBtn1 = document.getElementById("guideBtn1");
  
  if (guideBtn1) {
    guideBtn1.addEventListener("click", () => {
      Swal.fire({
        title: '에너지 등급 시뮬레이터 참고사항',
        html: `
          <b>1.</b> 해당 결과는 주소, 건물면적, 위도 경도 기준 일사량, 태양광 패널 정격 출력, 에너지 효율 등급 기준을 바탕으로 작성 되었습니다.<br><br>
          <b>2.</b> 태양광 패널의 발전 효율 상수는 0.8로 책정되었습니다.<br> 일반적인 태양광 패널 발전 효율은 0.75~0.85 사이입니다.<br><br>
          <b>3.</b> 에너지 효율 등급은 국토교통부 고시 제2021-1405호(2021.12.31) 기준을 따릅니다.<br>위도 경도 기준 일사량은 나사 위성 자료를 기반으로 산출되었습니다.<br><br>
          <b>4.</b> ZEB등급,녹색건축물등급에 따른 감면율은 공공기관 정보를 바탕으로 작성되었습니다.<br><br>
          <b>5.</b> 절세율은 중복되지 않으며, 결과의 감면율은 두 인증 등급의 감면율 중 높은 것으로 나타납니다.<br><br>
          <b>6.</b> 재산세 감면액은 지자체 조례에 따라 달라질 수 있습니다.
        `,
        icon: 'info',
        confirmButtonText: '닫기',
        focusConfirm: false,
        scrollbarPadding: false,
        heightAuto: false,  
      });
    });
  }


  const guideBtn2 = document.getElementById("guideBtn2");
  if (guideBtn2) {
    guideBtn2.addEventListener("click", () => {
      Swal.fire({
        title: '태양광 에너지 효율 경제성 시뮬레이터 참고사항',
        html: `
          <b>1.</b> 해당 결과는 주소, 건물면적, 위도 경도 기준 일사량, 태양광 패널 정격 출력, 에너지 효율 등급 기준을 바탕으로 작성 되었습니다.<br><br>
          <b>2.</b> 태양광 패널의 발전 효율 상수는 0.8로 책정되었습니다.<br> 일반적인 태양광 패널 발전 효율은 0.75~0.85 사이입니다.<br><br>
          <b>3.</b> 에너지 효율 등급은 국토교통부 고시 제2021-1405호(2021.12.31) 기준을 따릅니다.<br>위도 경도 기준 일사량은 나사 위성 자료를 기반으로 산출되었습니다.<br><br>
          <b>4.</b> 건축물 에너지 효율 등급 증가에 대한 에너지량은 에너지 등급 구간별 중간값으로 책정되었습니다.<br><br>
          <b>5.</b> 전기금액은 24년도 한국전력공사 표준 전기세 기준입니다.(kWh당 185.5원)<br><br>
          <b>6.</b> 탄소배출량은 24년도 국가별 탄소배출계수 기준입니다.(kWh당 0.419)
          
        `,
        icon: 'info',
        confirmButtonText: '닫기',
        focusConfirm: false,
        scrollbarPadding: false,
        heightAuto: false,  
      });
    });
  }
});


//에너지 등급 시뮬레이터
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('simulatorForm1');
    if (!form) return;
    

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const box = document.getElementById('resultBox1');
     
        const items = box.querySelectorAll('.result-item');
        
        

        const formData = new FormData(form);
        const resp = await fetch('/simulate1', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();
        
        if (!box) return;
      
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

       
        box.style.display='block'
        
      
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

      
        animateValue("total", 0, data.total, 2000, 0);
        animateValue("annualSaveElectric", 0, data.annualSaveElectric, 2000, 0);
        animateValue("annualSaveCO2", 0, data.annualSaveCO2, 2000, 1);
        animateValue("requiredPanels", 0, data.requiredPanels, 2000, 0);


        box.style.display = 'block';

      
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300);
        });
    });
});

// 빌딩에어리어 가져오기
document.addEventListener("DOMContentLoaded", () => {
    const area = sessionStorage.getItem("BuildingArea");
    console.log("세션스토리지에서 가져온 건물면적:", area);
    if (area) {
        document.getElementById("area1").value = area;
        document.getElementById("area2").value = area;
    }
});

// 위도경도가져오기
document.addEventListener("DOMContentLoaded", () => {
    const lat = sessionStorage.getItem("lat");
    const lon = sessionStorage.getItem("lon");
    console.log("세션스토리지에서 가져온 좌표:", lat, lon);
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

function animateValue(id, start, end, duration, decimals = 0) {
  const obj = document.getElementById(id);
  if (!obj) return;

  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = start + (end - start) * progress;
    obj.innerText = decimals === 0 ? Math.floor(value) : value.toFixed(decimals);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}





//htmltoimage
document.addEventListener('DOMContentLoaded', () => {
  const h2i = window.htmlToImage;
  if (!h2i) {
    console.error('html-to-image가 로드되지 않았습니다.');
    return;
  }

  document.getElementById("downloadBtn").addEventListener("click", async () => {
    const el = document.querySelector(".captureWrapper");
    console.log(el.getBoundingClientRect());

    if (!el) return;


    //웹 폰트 불러오는거 기다리기
    await document.fonts.ready;

    try {
      // png 생성
      const dataUrl = await h2i.toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        useCORS: true
      });
      
     
      // pdf 변환 // jspdf
      const pdf = new jspdf.jsPDF("p", "mm", "a4");
      const img = new Image();
    
      img.onload = function () {
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const imgW = pdfW;
        const imgH = (img.height * pdfW) / img.width;

        let hLeft = imgH;
        let pos = 0;

        pdf.addImage(img, "PNG", 0, pos, imgW, imgH);
        hLeft -= pdfH;

        while (hLeft > 0) {
          pos = hLeft - imgH;
          pdf.addPage();
          pdf.addImage(img, "PNG", 0, pos, imgW, imgH);
          hLeft -= pdfH;
        }
        const timestamp=getTimestamp();
        const filename =`simulator_${timestamp}`

        pdf.save(filename);
      };
      img.crossOrigin = "anonymous";
      img.src = dataUrl;

    } catch (err) {
      console.error("html-to-image PDF 변환 중 오류:", err);
    }
  });



  document.getElementById("sendMailBtn").addEventListener("click", async () => {
    const el = document.querySelector(".captureWrapper");
    if (!el) return;

    await document.fonts.ready;

     const { value: email } = await Swal.fire({
    title: '시뮬레이터 결과 메일 전송',
    input: 'email',
    inputLabel: '받을 이메일 주소를 입력하세요',
    inputPlaceholder: 'example@email.com',
    confirmButtonText: '보내기',
    showCancelButton: true,
    cancelButtonText: '취소',
    inputValidator: (value) => {
      if (!value) return '이메일을 입력해주세요!';
    },
  });
  if (!email) return;

  // 📍 2. 진행중 안내창
  Swal.fire({
    title: '메일 전송 중...',
    html: `
      <div id="progressBarContainer" style="width:100%;height:10px;background:#eee;border-radius:5px;">
        <div id="progressBar" style="width:0%;height:100%;background:#28a745;border-radius:5px;transition:width 0.3s;"></div>
      </div>
      <p id="statusText" style="margin-top:10px;">잠시만 기다려주세요...</p>
    `,
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
      const bar = document.getElementById('progressBar');
      const text = document.getElementById('statusText');
      let progress = 0;
       const stages = [
        { limit: 25, msg: 'PDF 변환 중...' },
        { limit: 50, msg: 'Blob 변환 중...' },
        { limit: 75, msg: '메일 준비 중...' },
        { limit: Infinity, msg: '메일 보내는 중...' }
      ];
      const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress >= 100) progress = 99;
        bar.style.width = `${progress}%`;

        const current = stages.find(s => progress < s.limit);
        if (current) text.textContent = current.msg;

      }, 500);
      Swal._interval = interval;
    },
  });

    try {
      const dataUrl = await h2i.toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        useCORS: true
      });

      const pdf2 = new jspdf.jsPDF("p", "mm", "a4");
      const img2 = new Image();
      img2.crossOrigin = "anonymous";
      img2.src = dataUrl;

      // Promise-pdf
      const pdfBlob = await new Promise((resolve) => {
        img2.onload = function () {
          const pdfW = pdf2.internal.pageSize.getWidth();
          const pdfH = pdf2.internal.pageSize.getHeight();
          const imgW = pdfW;
          const imgH = (img2.height * pdfW) / img2.width;

          pdf2.addImage(img2, "PNG", 0, 0, imgW, imgH);
          const blob2 = pdf2.output("blob");
          resolve(blob2);
        };
      });

     
      const timestamp = getTimestamp();
      const formData = new FormData();
      formData.append("email", email);
      formData.append("file", pdfBlob, `SimulatorResult_${timestamp}.pdf`);

      const resp = await fetch("/sendMail", {
        method: "POST",
        body: formData
      });

      const result = await resp.text();

      clearInterval(Swal._interval);
      Swal.close();

      Swal.fire({
        icon: "success",
        title: "메일 발송 완료!",
        text: result,
        confirmButtonText: "확인",
      });


    } catch (err) {
      console.error("메일 전송 중 오류:", err);
      clearInterval(Swal._interval);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "메일 전송 실패",
        text: "메일 발송 중 오류가 발생했습니다.",
      });
    }
  });
});

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}







