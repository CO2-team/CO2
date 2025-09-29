
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
    // 결과 박스 보이기
    const box = document.getElementById('resultBox');
    if (box) box.style.display = 'block';

   
  });
});
