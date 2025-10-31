document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.navbar');
  const header = document.getElementById('menubar');
  const logo = document.querySelector('.logo_toggle');
  const menuToggle = document.querySelector('.menu-toggle');

  if (!navbar || !header) return;

  const delta = 15;
  let lastScrollTop = 0;
  const path = window.location.pathname;

  //  메인 페이지 판별
  const isMainPage = path.includes('/main') || path === '/' || path === '';

  //  메인 페이지가 아닐 경우 헤더 숨기기 (collapsed 추가)
  if (!isMainPage) {
    header.classList.add('collapsed');
    header.style.backgroundColor = '#111';
    return; // 여기서 종료 (스크롤 이벤트 안 걸림)
  }

  //  메인 페이지인 경우만 스크롤 이벤트 작동
  const scrollTarget = document.querySelector('.container') || window;

  scrollTarget.addEventListener('scroll', () => {
    const st = scrollTarget.scrollTop || window.scrollY;
    if (Math.abs(lastScrollTop - st) <= delta) return;

    if (st > lastScrollTop && st > 0) {
      navbar.classList.add('nav-up'); // 스크롤 내릴 때 숨김
    } else {
      navbar.classList.remove('nav-up'); // 스크롤 올릴 때 보임
    }

    lastScrollTop = st;
  });

  //  메뉴 토글
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      navbar.classList.toggle('active');
    });
  }

  // //  로고 클릭 시 메인 이동
  // if (logo) {
  //   logo.addEventListener('click', () => {
  //     window.location.href = '/main';
      
  //   });
  // }

  //  메인 페이지에서는 투명 배경 유지
  header.style.backgroundColor = 'transparent';
  header.style.transition = 'background-color 0.4s ease';
});

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', () => {
      window.location.href = '/main';
      console.log('로고 클릭됨, 메인 페이지로 이동');
    });
  }
});