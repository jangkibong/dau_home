/*! main.js — Clean Rebuild (Snap logic removed + SubVisual section-wide control)
 * jQuery 3.7.1
 * - Intro: viewport 100% 덮을 때만 진행도 모션(화면 고정)
 * - Scroller: 부드러운 감쇠 스크롤(관성)
 * - Sub Visual: .sub_visual_content 세로 슬라이드, section 전체 스크롤로 제어
 *   - 스와이퍼가 이동 가능한 경우, 화면(페이지) 스크롤은 완전히 차단
 *   - 스와이퍼 경계(처음/마지막)에서만 페이지 스크롤 통과
 */

(function ($, win, doc) {
    $("heder").css({ opacity: 1 });
    window.scrollEnabled = true;

    // 제어 함수도 window에 붙여두면 더 편리
    window.disableCustomScroll = function () {
        window.scrollEnabled = false;
    };
    window.enableCustomScroll = function () {
        window.scrollEnabled = true;
    };

    if (!$) return;

    // =========================================================
    // 1) 인트로 - gsap
    // =========================================================
    gsap.registerPlugin(ScrollTrigger, Observer);

    // ScrollTrigger.config({autoRefreshEvents: "visibilitychange,DOMContentLoaded,load"});

    // =========================================================
    // Lenis 부드러운 스크롤 초기화 + GSAP 동기화
    // =========================================================
    if (typeof Lenis !== "undefined") {
        const lenis = new Lenis({
            duration: 1.4, // 0.8~1.4 권장
            smoothWheel: true,
            smoothTouch: false,
            touchMultiplier: 0.8, // 터치 스크롤 배수
            easing: (t) => 1 - Math.pow(1 - t, 3),
        });

        lenis.on("scroll", () => {
            ScrollTrigger.update();
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }

    const MomentumKiller = (() => {
        let obs = null,
            tId = 0,
            freezing = false;

        function stopScrollJank() {
            // 현재 위치로 강제 고정해 관성 끊기
            const y = window.pageYOffset || document.documentElement.scrollTop || 0;
            window.scrollTo(0, y);
            requestAnimationFrame(() => window.scrollTo(0, y));
        }

        function freeze(ms = 400) {
            if (freezing) {
                clearTimeout(tId);
                tId = setTimeout(unfreeze, ms);
                stopScrollJank();
                return;
            }
            freezing = true;
            stopScrollJank();

            // wheel/touch/scroll 입력을 즉시 무력화
            obs = Observer.create({
                type: "wheel,touch,scroll,pointer",
                onChange: stopScrollJank,
                onChangeY: stopScrollJank,
                onWheel: stopScrollJank,
                onTouchMove: stopScrollJank,
                onScroll: stopScrollJank,
                preventDefault: true,
                allowClicks: true,
            });

            // 키보드도 잠깐 차단
            window.addEventListener("keydown", keyBlock, true);

            tId = setTimeout(unfreeze, ms);
        }

        function keyBlock(e) {
            const k = e.key;
            if (
                k === " " ||
                k === "Spacebar" ||
                k === "PageDown" ||
                k === "PageUp" ||
                k === "ArrowDown" ||
                k === "ArrowUp" ||
                k === "Home" ||
                k === "End"
            ) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }

        function unfreeze() {
            if (obs) {
                obs.kill();
                obs = null;
            }
            window.removeEventListener("keydown", keyBlock, true);
            freezing = false;
        }

        return { freeze, unfreeze };
    })();

    const ani1 = gsap.timeline();

    ani1.from("#intro .main_title", { autoAlpha: 0 });

    ani1.to("#intro .visual_img_box video", {
        keyframes: [
            { scale: 1, duration: 1 },
            { scale: 0.55, duration: 1 },
            { y: -100, duration: 1 },
            { y: -400, duration: 1 },
        ],
    }).to(
        "#intro .main_title",
        {
            keyframes: [
                { y: 0, duration: 1 },
                { y: "-60vh", duration: 2 },
                { duration: 0.5 },
            ],
        },
        0
    );

    ScrollTrigger.create({
        animation: ani1,
        trigger: "#intro",
        start: "top top",
        end: "+=2000",
        scrub: true,
        pin: true,
        anticipatePin: 1,
        markers: false,
    });

    /* =========================================================
     * Sub Visual
     * =======================================================*/
    const ani2 = gsap.timeline();
    ScrollTrigger.create({
        animation: ani2,
        trigger: "#overview",
        start: "top top",
        end: "+=2000",
        scrub: true,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
    });

    // --------------------------------------------
    // Helpers (DOM 보강, a11y, 인디케이터 페이드)
    // --------------------------------------------
    function upgradeToSwiperDOM($container) {
        if ($container.children(".swiper-wrapper").length) {
            return $container.find(".swiper-slide").toArray();
        }
        $container.addClass("swiper");
        const $items = $container.find(".sub_visual_item");
        const wrapper = document.createElement("div");
        wrapper.className = "swiper-wrapper";
        $items.each(function (_, el) {
            const slide = document.createElement("div");
            slide.className = "swiper-slide";
            el.parentNode.insertBefore(slide, el);
            slide.appendChild(el);
            wrapper.appendChild(slide);
        });
        $container.append(wrapper);
        return Array.from($container.find(".swiper-slide"));
    }

    function decorateIndicatorsA11y($wrap, $indicators) {
        $wrap.attr({ role: "tablist", "aria-label": "섹션 슬라이드 인디케이터" });
        $indicators.each(function (idx) {
            $(this)
                .attr({
                    role: "tab",
                    tabindex: idx === 0 ? "0" : "-1",
                    "aria-selected": idx === 0 ? "true" : "false",
                })
                .css("opacity", idx === 0 ? 1 : 0);
        });
    }

    function fadeSetIndicator($indicators, activeIndex, immediate) {
        const DURATION = 280;
        $indicators.each(function (idx) {
            const $it = $(this);
            const isActive = idx === activeIndex;
            $it.toggleClass("is-active", isActive)
                .attr("aria-selected", isActive ? "true" : "false")
                .attr("tabindex", isActive ? "0" : "-1");
            const toOpacity = isActive ? 1 : 0;
            if (immediate) $it.stop(true, true).css("opacity", toOpacity);
            else $it.stop(true, true).animate({ opacity: toOpacity }, DURATION, "swing");
        });
    }

    const getActiveIndex = (sw) =>
        (sw && (typeof sw.realIndex === "number" ? sw.realIndex : sw.activeIndex)) || 0;

    $(function () {
        $(".sub_visual").each(function () {
            const $host = $(this);
            const $container = $host.find(".sub_visual_content");
            const $titlesWrap = $host.find(".sub_titles_wrap");
            const $indicators = $titlesWrap.find(".sub_tilte_wrap");
            if (!$container.length || !$indicators.length) return;

            const slideEls = upgradeToSwiperDOM($container);
            decorateIndicatorsA11y($titlesWrap, $indicators, slideEls);

            // ===== Swiper (세로) : GSAP 단독 제어를 위해 제스처/휠 OFF =====
            const swiper = new Swiper($container.get(0), {
                direction: "vertical",
                effect: "slide",
                speed: 600,
                loop: false,
                allowTouchMove: false, // 스와이프 제스처 끔 (GSAP만으로 넘김)
                // mousewheel은 완전히 비활성화(충돌 방지)
                mousewheel: false,
                resistanceRatio: 0, // 끝에서 바운스 제거
                touchReleaseOnEdges: true,
                observeParents: true,
                observer: true,
                on: {
                    afterInit(sw) {
                        fadeSetIndicator($indicators, getActiveIndex(sw), true);
                    },
                    slideChange(sw) {
                        fadeSetIndicator($indicators, getActiveIndex(sw));
                    },
                },
            });

            // 인디케이터 클릭/키보드 이동은 유지 (원하면 스크롤 진행도도 동기화 가능)
            $indicators
                .on("click", function () {
                    const idx = $(this).index();
                    swiper.slideTo(idx, 600);
                })
                .on("keydown", function (e) {
                    const idx = $(this).index();
                    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                        e.preventDefault();
                        swiper.slideTo(idx, 600);
                    }
                });

            // ===== ScrollTrigger(핀 없음) : 진행도→슬라이드 인덱스 =====
            // 총 4장일 때 0%, 25%, 50%, 75%, 100%에서 0,1,2,3으로 스냅
            const TOTAL = 4; // ★ 페이지 수(원하면 slideEls.length로 교체 가능)
            const MAX_INDEX = TOTAL - 1;
            let lastIdx = -1;

            ScrollTrigger.create({
                trigger: "#overview",
                start: "top top",
                end: "+=2000",
                scrub: true,
                // 핀은 위의 첫 번째 ST가 담당 → 여기서는 pin 주지 않음
                // markers: true,
                // 스냅 제거: 섹션 경계 이탈 시 튕김 현상 방지
                onUpdate(self) {
                    // 진행도(0~1) → 인덱스 (25%마다 1씩 증가)
                    // 소수 경계에서 떨림 방지용 EPS
                    const EPS = 1e-6;
                    let idx = Math.floor((self.progress + EPS) * TOTAL);
                    if (idx > MAX_INDEX) idx = MAX_INDEX;
                    if (idx !== lastIdx) {
                        lastIdx = idx;
                        swiper.slideTo(idx, 600, false); // GSAP 트리거로만 넘김
                    }
                },
                onRefresh(self) {
                    self.update();
                },
            });

            // 레이아웃 변경 대응
            let raf;
            const safeRefresh = () => {
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => ScrollTrigger.refresh());
            };
            window.addEventListener("resize", safeRefresh);
            window.addEventListener("orientationchange", safeRefresh);
        });
    });

    /* =========================================================
     * 3) project Swiper - gsap (핀 고정) + Swiper
     * =======================================================*/
    const ani3 = gsap.timeline();

    ScrollTrigger.create({
        animation: ani3,
        trigger: "#project_wrap",
        start: "top top",
        end: "+=1000",
        scrub: true,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
    });
    /* =========================================================
     * 6) #project Horizontal Swiper
     * =======================================================*/
    (function ($, win, doc) {
        if (!$) return;

        // ---------------------------------------------
        // [유틸] 환경설정: 애니메이션 최소화 여부
        // ---------------------------------------------
        function prefersReducedMotion() {
            return win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
        }
        // 역할: 자동재생 가능 환경인지 판단
        function shouldAutoplay() {
            return !prefersReducedMotion();
        }

        // ---------------------------------------------
        // GSAP 핀 고정 시 autoplay
        // ---------------------------------------------
        $(function registerPinBasedProjectSwiper() {
            const $section = $("#project");
            if (!$section.length || typeof ScrollTrigger === "undefined") return;

            // 핀 트리거와 동일한 영역/세팅을 사용해 라이프사이클만 담당하는 ST 생성
            ScrollTrigger.create({
                trigger: "#project_wrap",
                start: "top top",
                end: "+=1000",
                // pin: true  // ← 애니메이션용 ST에서 이미 pin을 쓰고 있으므로 여기서는 생략
                onEnter: handleEnterLikePin,
                onEnterBack: handleEnterLikePin,
                onLeave: handleLeaveLikeUnpin,
                onLeaveBack: handleLeaveLikeUnpin,
            });

            function ensureInited() {
                let sw = getProjectInstance();
                if (!sw) {
                    sw = initProjectSwiper($section);
                }
                return sw;
            }

            function handleEnterLikePin() {
                const sw = ensureInited();
                if (sw && sw.autoplay) {
                    if (shouldAutoplay()) sw.autoplay.start();
                    reflectPlayState(sw, $(".project-controls .swiper-play-toggle"));
                }
            }

            function handleLeaveLikeUnpin() {
                const sw = getProjectInstance();
                if (sw && sw.autoplay) {
                    sw.autoplay.stop();
                    reflectPlayState(sw, $(".project-controls .swiper-play-toggle"));
                }
            }
        });

        // ---------------------------------------------
        // [상태] 스와이퍼 인스턴스 저장/조회 (중복 초기화 방지)
        // ---------------------------------------------
        function setProjectInstance(sw) {
            win.__dauProjectSwiper = sw;
        }
        function getProjectInstance() {
            return win.__dauProjectSwiper || null;
        }

        // ---------------------------------------------
        // #project 영역 스와이퍼 초기화 (1회)
        //  - DOM 보강, 접근성 세팅, 이벤트 바인딩
        //  - 변경: initialSlide = 0 고정, 저장/복원 로직 제거
        // ---------------------------------------------
        function initProjectSwiper($root) {
            // 컨테이너
            let $swiper = $root.find(".swiper").first();
            if (!$swiper.length) return null;

            // 1) .swiper_wrap 보강(버튼 absolute 기준)
            let $wrap = $swiper.closest(".swiper_wrap");
            if (!$wrap.length) {
                $wrap = $('<div class="swiper_wrap"></div>');
                $swiper.after($wrap);
                $wrap.append($swiper);
            }

            // 2) 좌/우 버튼 생성(없으면)
            if (!$wrap.find(".swiper-button-prev").length) {
                $wrap.append(
                    '<button type="button" class="swiper-button-prev" aria-label="이전 슬라이드"></button>'
                );
            }
            if (!$wrap.find(".swiper-button-next").length) {
                $wrap.append(
                    '<button type="button" class="swiper-button-next" aria-label="다음 슬라이드"></button>'
                );
            }

            // 3) 하단 컨트롤(.project-controls) + pagination + play-toggle 생성(없으면)
            let $controls = $root.find(".project-controls").first();
            if (!$controls.length) {
                $controls = $(
                    '<div class="project-controls" role="group" aria-label="프로젝트 슬라이드 컨트롤"></div>'
                );
                $wrap.append($controls);
            }
            if (!$controls.find(".swiper-pagination").length) {
                $controls.append(
                    '<div class="swiper-pagination" aria-label="프로젝트 슬라이드 인디케이터"></div>'
                );
            }
            if (!$controls.find(".swiper-play-toggle").length) {
                // 기본은 '재생 중' 상태이므로 토글은 pause 아이콘(CSS) 노출 가정
                $controls.append(
                    '<button type="button" class="swiper-play-toggle" aria-pressed="false">toggle</button>'
                );
            }

            const $btnPrev = $wrap.find(".swiper-button-prev");
            const $btnNext = $wrap.find(".swiper-button-next");
            const $pagination = $controls.find(".swiper-pagination");
            const $playToggle = $controls.find(".swiper-play-toggle");

            // 4) .swiper 내부 슬라이드 래핑 보강 (이미 wrapper가 있으면 패스)
            ensureSlides($swiper);

            // 5) 초기 인덱스: 항상 0으로 고정 (저장/복원 제거)
            const initial = 0;

            // 6) Swiper 생성
            const sw = new Swiper($swiper.get(0), {
                direction: "horizontal",
                effect: "slide",
                speed: 700,
                loop: true,
                initialSlide: initial,
                allowTouchMove: true,
                mousewheel: false, // 섹션에서 수동으로 wheel 제어할 거라면 false 유지
                observer: true,
                observeParents: true,
                touchAngle: 45,
                preventInteractionOnTransition: true,
                a11y: { enabled: true },

                navigation: {
                    nextEl: $btnNext.get(0),
                    prevEl: $btnPrev.get(0),
                },
                pagination: {
                    el: $pagination.get(0),
                    clickable: true,
                    bulletClass: "swiper-pagination-bullet",
                    bulletActiveClass: "swiper-pagination-bullet-active",
                    // 접근성 라벨
                    renderBullet: function (index, className) {
                        const n = index + 1;
                        return `<span class="${className}" role="tab" aria-label="${n}번 슬라이드" aria-controls="project-slide-${n}" tabindex="${
                            index === initial ? 0 : -1
                        }"></span>`;
                    },
                },
                autoplay: shouldAutoplay()
                    ? { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: false }
                    : false,

                on: {
                    afterInit(swiper) {
                        reflectPlayState(swiper, $playToggle);
                        // pagination bullets 접근성 동기화
                        syncPaginationA11y($pagination, getActiveIndex(swiper));
                    },
                    slideChange(swiper) {
                        // ※ 저장/복원 제거: 로컬스토리지 쓰지 않음
                        syncPaginationA11y($pagination, getActiveIndex(swiper));
                    },
                },
            });

            // 7) 플레이/일시정지 토글
            $playToggle.off("click.projectSwiper").on("click.projectSwiper", function (e) {
                e.preventDefault();
                if (!sw.autoplay) return;
                if (sw.autoplay.running) sw.autoplay.stop();
                else if (shouldAutoplay()) sw.autoplay.start();
                reflectPlayState(sw, $playToggle);
            });

            setProjectInstance(sw);
            return sw;
        }

        /* -------------------- 유틸/헬퍼 -------------------- */

        // .swiper 내부를 .swiper-wrapper/.swiper-slide 구조로 보강
        function ensureSlides($container) {
            if ($container.children(".swiper-wrapper").length) return;
            const $items = $container.find(".project_item, .swiper_item, .slide_item, > *");
            const wrapper = doc.createElement("div");
            wrapper.className = "swiper-wrapper";
            $items.each(function (i, el) {
                if (
                    el.classList.contains("swiper-wrapper") ||
                    el.classList.contains("swiper-slide")
                )
                    return;
                const slide = doc.createElement("div");
                slide.className = "swiper-slide";
                if (!el.id) el.id = `project-slide-${i + 1}`; // bullets aria-controls 타겟
                el.parentNode.insertBefore(slide, el);
                slide.appendChild(el);
                wrapper.appendChild(slide);
            });
            $container.append(wrapper);
        }

        // bullets에 tabindex/aria-selected 동기화(접근성)
        function syncPaginationA11y($pagi, activeIdx) {
            const $bullets = $pagi.find(".swiper-pagination-bullet");
            $bullets.each(function (i) {
                const $b = $(this);
                const isActive = i === activeIdx;
                $b.attr({
                    tabindex: isActive ? "0" : "-1",
                    "aria-selected": isActive ? "true" : "false",
                });
            });
        }

        // 재생 상태 반영(토글 버튼 aria, CSS 클래스)
        function reflectPlayState(swiper, $toggleBtn) {
            const running = !!(swiper.autoplay && swiper.autoplay.running);
            if ($toggleBtn && $toggleBtn.length) {
                $toggleBtn
                    .toggleClass("is-paused", !running) // CSS: .is-paused → '재생' 아이콘 노출 가정
                    .attr("aria-pressed", (!running).toString());
            }
        }

        // Swiper 활성 인덱스 얻기
        function getActiveIndex(swiper) {
            if (!swiper) return 0;
            if (typeof swiper.realIndex === "number") return swiper.realIndex;
            if (typeof swiper.activeIndex === "number") return swiper.activeIndex;
            return 0;
        }
    })(jQuery, window, document);

    /* =========================================================
     * 7) tech 호버패널 - gsap (핀 고정)
     * =======================================================*/

    const mm = gsap.matchMedia();

    mm.add("(min-width: 721px)", () => {
        const ani4 = gsap.timeline();

        ScrollTrigger.create({
            animation: ani4,
            trigger: "#tec",
            start: "top top",
            end: "+=1000",
            scrub: true,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
        });
    });

    mm.add("(max-width: 720px)", () => {
        const ani4 = gsap.timeline();

        ScrollTrigger.create({
            animation: ani4,
            trigger: "#tec",
            start: "top top",
            end: "+=1000",
            scrub: true,
            pin: false,
            anticipatePin: 1,
            invalidateOnRefresh: true,
        });
    });

    window.addEventListener("resize", function () {
        ScrollTrigger.refresh();
    });

    $(function () {
        const $firstItem = $("#tec .section_content_item").first();
        const $firstPanel = $firstItem.find(".image_wrap + .panel");
        $firstItem.addClass("on");
        $firstPanel.slideDown().attr("aria-hidden", "true");

        $("#tec").on("mouseenter focusin", ".section_content_item", function () {
            const $nowPanel = $(this).find(".image_wrap").first().next("div");
            $(this).addClass("on").siblings().removeClass("on");
            $nowPanel
                .css({ display: "flex" })
                .hide()
                .stop(true, true)
                .slideDown(300)
                .attr("aria-hidden", "false");
            $(this).siblings().find(".panel").slideUp(200).attr("aria-hidden", "true");
        });
    });

    // -----------------------------------------------------
    // 8) PR 가로 스와이퍼 (#pr .section_contents .swiper)
    // -----------------------------------------------------
    (function initPRSwiper() {
        const prHost = document.querySelector("#pr .section_contents .swiper");
        if (!prHost) return;
        if (prHost.__inited) return;
        prHost.__inited = true;

        const items = Array.from(prHost.querySelectorAll(".swiper_item"));
        if (!items.length) return;

        const wrapper = document.createElement("div");
        wrapper.className = "swiper-wrapper";

        items.forEach((item) => {
            const slide = document.createElement("div");
            slide.className = "swiper-slide";
            slide.appendChild(item);
            wrapper.appendChild(slide);
        });

        while (prHost.firstChild) prHost.removeChild(prHost.firstChild);
        prHost.appendChild(wrapper);

        const pad2 = (n) => String(n).padStart(2, "0");

        const prSwiper = new Swiper(prHost, {
            direction: "horizontal",
            slidesPerView: "auto",
            spaceBetween: 70,
            centeredSlides: false,
            loop: false,
            speed: 600,
            allowTouchMove: true,
            simulateTouch: true,
            grabCursor: true,
            nested: true,
            touchAngle: 30,
            threshold: 6,
            navigation: {
                prevEl: ".btn_prev",
                nextEl: ".btn_next",
            },
            breakpoints: {
                720: {
                    spaceBetween: 160,
                },
            },
            on: {
                init() {
                    const total = this.slides.length - this.loopedSlides * 2 || this.slides.length;
                    document.querySelector(".count .total").textContent = pad2(total);
                    document.querySelector(".count .current").textContent = pad2(
                        this.realIndex + 1
                    );
                },
                slideChange() {
                    document.querySelector(".count .current").textContent = pad2(
                        this.realIndex + 1
                    );
                },
            },
        });
    })();
})(window.jQuery, window, document);

// 반응형 크기 / 이미지 / 영상 변경
$(function () {
    // =========================================================
    // 0) 모바일 뷰포트 높이 계산
    // =========================================================
    function setRealVH() {
        // window.innerHeight = 네비게이션 바 제외하고 실제 보이는 높이
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }
    // 페이지 처음 로드할 때 실행
    setRealVH();

    const updateMainVisual = () => {
        const $intro = $(".main_visual_img");
        const $subVisualImg = $("#fullpage .section img");

        if ($(window).width() <= 720) {
            // 모바일용
            $intro.attr("src", "./images/main/mo_all_source_down.mp4");
            $subVisualImg.eq(0).attr("src", "./images/main/sub_visual_mo_1.svg");
            $subVisualImg.eq(1).attr("src", "./images/main/sub_visual_mo_2.svg");
            $subVisualImg.eq(2).attr("src", "./images/main/sub_visual_mo_3.svg");
            $subVisualImg.eq(3).attr("src", "./images/main/sub_visual_mo_4.svg");
        } else {
            // PC용
            $intro.attr("src", "./images/main/pc_all_source_down.mp4");
            $subVisualImg.eq(0).attr("src", "./images/main/sub_visual_1.svg");
            $subVisualImg.eq(1).attr("src", "./images/main/sub_visual_2.svg");
            $subVisualImg.eq(2).attr("src", "./images/main/sub_visual_3.svg");
            $subVisualImg.eq(3).attr("src", "./images/main/sub_visual_4.svg");
        }
    };

    updateMainVisual();

    let lastWidth = $(window).width();

    $(window).on("resize", function () {
        const currentWidth = $(window).width();
        if (currentWidth !== lastWidth) {
            // 가로폭이 달라졌을 때만 호출
            updateMainVisual(); 
            setRealVH();
            lastWidth = currentWidth; // 이전 폭 갱신
        }
    });
});

// 모바일에서 로딩시 헤더 움직이지 않는 문제 해결용
document.head.insertAdjacentHTML("beforeend", `<style>header{opacity:1;}</style>`);
