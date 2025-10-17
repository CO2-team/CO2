document.addEventListener('DOMContentLoaded', () => {
  let lastScrollTop = 0;
  const delta = 15;
  const navbar = document.querySelector('.navbar');
  const header = document.getElementById('menubar');
  const logo = document.querySelector('.logo');

  if (!navbar) return;

  // 스크롤 대상 (window or .container)
  const scrollTarget = document.querySelector('.container') || window;

  scrollTarget.addEventListener('scroll', () => {
    const st = scrollTarget.scrollTop || window.scrollY;

    if (Math.abs(lastScrollTop - st) <= delta) return;

    if (st > lastScrollTop && st > 0) {
      navbar.classList.add('nav-up');
    } else {
      navbar.classList.remove('nav-up');
    }

    lastScrollTop = st;
  });

  // 로고 클릭 시 메인 이동
  if (logo) {
    logo.addEventListener('click', () => {
      window.location.href = '/main';
    });
  }

  // 페이지별 배경색
  const path = window.location.pathname;
  if (path.endsWith('main') || path === '/' || path === '') {
    header.style.backgroundColor = 'transparent';
  } else {
    header.style.backgroundColor = '#111';
  }

  header.style.transition = 'background-color 0.4s ease';
});
