
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

    // TAX만 우선 표시
    document.getElementById('propertyTax').textContent = data.propertyTax ?? '-';
    document.getElementById('acquireTax').textContent  = data.acquireTax ?? '-';
    document.getElementById('areaBonus').textContent   = data.areaBonus ?? '-';
    document.getElementById('grade').textContent       = data.grade ?? '-';
    document.getElementById('category').textContent    = data.category ?? '-';

    document.getElementById('energySelf').textContent = data.energySelf ?? '-';
    document.getElementById('certificationDiscount').textContent = data.certificationDiscount ?? '-';
    document.getElementById('renewableSupport').textContent = data.renewableSupport ?? '-';
    document.getElementById('zebGrade').textContent = data.zebGrade ?? '-';    // 결과 박스 보이기

    const box = document.getElementById('resultBox');
    if (box) box.style.display = 'block';

    const items = box.querySelectorAll('.result-item');
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
