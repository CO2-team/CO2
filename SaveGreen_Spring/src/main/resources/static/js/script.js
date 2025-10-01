document.addEventListener("DOMContentLoaded", () => {
    let lastScrollTop = 0;
    const navbar = document.getElementById("menubar");

    window.addEventListener("scroll", function() {
        let currentScroll = window.scrollY;

        if (currentScroll > lastScrollTop) {
            navbar.style.top = "-80px"; // 아래로 스크롤 → 숨김
        } else {
            navbar.style.top = "0"; // 위로 스크롤 → 보이기
        }

        lastScrollTop = currentScroll;
    });
});


const banners = document.querySelectorAll('.main-banner');

window.addEventListener('wheel', () => {
    console.log("스크롤 이벤트 작동!");
    banners.forEach((banner, idx) => {
        const rect = banner.getBoundingClientRect();

        // 화면 중앙에 배너가 위치하면 active
        if(rect.top < window.innerHeight/2 && rect.bottom > window.innerHeight/2){
            banner.classList.add('active');
        } else {
            banner.classList.remove('active');
        }
    });

});   