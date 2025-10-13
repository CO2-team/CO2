var didScroll;

var lastScrollTop = 0;
var delta = 5; //동작의 구현이 시작되는 위치
var navbatHeight = $('.header').outerHeight(); //영향을 받을 요소를 선택

$(window).scroll(function(evnet){ //스크롤 시 사용자가 스크롤했다는 것을 알림
  didScroll  = true;
  console.log("scrolling");
});

$(function(){
  let lastScrollTop = 0;
  const delta = 15;

  $(window).scroll(function(event){
    const st = $(this).scrollTop();
    if(Math.abs(lastScrollTop - st) <= delta) return;
    if((st > lastScrollTop) && (lastScrollTop > 0)) {
      $('.header').addClass('nav-up');
    }else {
      $('.header').removeClass('nav-up');
    };
    lastScrollTop = st;
  });
});
