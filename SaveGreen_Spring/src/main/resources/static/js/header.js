// header.js - DOMContentLoaded 사용, 안전 체크 및 간단 쓰로틀 포함

document.addEventListener('DOMContentLoaded', function () {
  // 안전하게 요소 선택
  const navbar = document.querySelector('.navbar');
  const header = document.querySelector('.header');

  if (!navbar) {
    console.warn('header.js: .navbar 요소를 찾을 수 없습니다. header.html에 .navbar가 있는지 확인하세요.');
    return;
  }

  let lastScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const delta = 10; // 너무 작은 변화 무시
  const hideAfter = 100; // 이 위치 이후부터 숨김 동작 적용
  let ticking = false; // 쓰로틀용

  function onScroll() {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;

    // 너무 작은 변화는 무시
    if (Math.abs(lastScrollTop - currentScroll) <= delta) {
      lastScrollTop = Math.max(0, currentScroll);
      return;
    }

    // 아래로 스크롤 && 위치가 충분히 내려갔을 때 숨김
    if (currentScroll > lastScrollTop && currentScroll > hideAfter) {
      if (!navbar.classList.contains('nav-hidden')) {
        navbar.classList.add('nav-hidden');
      }
    }
    // 위로 스크롤하면 보여주기
    else if (currentScroll < lastScrollTop) {
      if (navbar.classList.contains('nav-hidden')) {
        navbar.classList.remove('nav-hidden');
      }
    }

    lastScrollTop = Math.max(0, currentScroll);
  }

  // rAF 기반 간단 쓰로틀 (스크롤 빈도 낮춤)
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  // (디버그용) 콘솔에 현재 상태 찍어보기 - 배포 시 주석 처리 가능
  // window.addEventListener('scroll', () => console.log('scrollY', window.scrollY, 'navHidden', navbar.classList.contains('nav-hidden')));
});
