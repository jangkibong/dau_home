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
    // 0) 모바일 뷰포트 높이 계산
    // =========================================================
    function setRealVH() {
        // window.innerHeight = 네비게이션 바 제외하고 실제 보이는 높이
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }
    // 페이지 처음 로드할 때 실행
    setRealVH();
    // 화면 크기 바뀌면 다시 계산
    window.addEventListener("resize", setRealVH);

    // =========================================================
    // 1) 인트로 - gsap
    // =========================================================
    gsap.registerPlugin(ScrollTrigger, Observer);

    // ScrollTrigger.config({autoRefreshEvents: "visibilitychange,DOMContentLoaded,load"});

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
                { y: "-60vh", duration: 1 },
            ],
        },
        0
    );

    ScrollTrigger.create({
        animation: ani1,
        trigger: "#intro",
        start: "top top",
        end: "+=1500",
        scrub: true,
        pin: true,
        anticipatePin: 1,
        markers: false,
    });

    // =========================================================
    // 2) Sub Visual - gsap (핀 고정) + Swiper
    // =========================================================
    const ani2 = gsap.timeline();
    let isOverviewPinned = false; // 핀 상태 플래그

    ScrollTrigger.create({
        id: "overviewPin",
        animation: ani2,
        trigger: "#overview",
        start: "top top",
        end: "+=1000",
        scrub: true,
        pin: true,
        anticipatePin: 1,
        markers: false,
        onEnter() {
            isOverviewPinned = true;
            toggleSlideLockAll(true);
            MomentumKiller.freeze(700);
        },
        onEnterBack() {
            isOverviewPinned = true;
            toggleSlideLockAll(true);
            MomentumKiller.freeze(700);
        },
        onLeave() {
            isOverviewPinned = false;
            toggleSlideLockAll(false);
        },
        onLeaveBack() {
            isOverviewPinned = false;
            toggleSlideLockAll(false);
        },
    });

    (function SubVisualTickMode() {
        // --------------------------------------------
        // Helpers
        // --------------------------------------------
        const isMiddle = (sw) => !(sw.isBeginning || sw.isEnd);

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

        function decorateIndicatorsA11y($wrap, $indicators, slideEls) {
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

        // 섹션별 언락 함수 저장
        const sectionLocks = new Map(); // key: HTMLElement(section), value: unlockFn + .swiper

        // overview 핀 변화에 따라 모든 섹션 락/언락
        window.toggleSlideLockAll = function (enable) {
            sectionLocks.forEach((unlock, sectionEl) => {
                unlock?.(); // 기존 바인딩 제거
                if (enable) lockScrollToSlides($(sectionEl), sectionLocks.get(sectionEl).swiper);
            });
        };

        // --------------------------------------------
        // 한 칸씩 전환 + 조건부 스크롤 허용
        // --------------------------------------------
        function lockScrollToSlides($section, swiper) {
            const NS = ".svTick";
            const speed = swiper.params.speed || 600;

            // 중간 슬라이드 판정
            const isMiddle = (sw) => !(sw.isBeginning || sw.isEnd);
            // 전환중 판정 (Swiper 10+/11)
            const isBusy = () => !!swiper.animating;

            // 휠 델타 정규화(px) + 누적
            let wheelAcc = 0;
            const WHEEL_ACTIVATION = 60; // 트랙패드에서 너무 예민하지 않도록
            function normWheelDelta(oe) {
                let dy = oe.deltaY || 0;
                // 0: pixel, 1: line, 2: page
                if (oe.deltaMode === 1) dy *= 16;
                else if (oe.deltaMode === 2) dy *= window.innerHeight;
                return dy;
            }

            // 터치 시작/이동
            let tStartY = 0;
            let touchAcc = 0;
            const TOUCH_ACTIVATION = 24;

            // 기존 바인딩 해제
            const secEl = $section.get(0);
            $section.off("touchstart" + NS).off("keydown" + NS);
            // native로 건 건 직접 remove 필요하므로 핸들러를 변수로 보존
            if (secEl.__wheelHandler) secEl.removeEventListener("wheel", secEl.__wheelHandler);
            if (secEl.__touchMoveHandler)
                secEl.removeEventListener("touchmove", secEl.__touchMoveHandler);

            if (!isOverviewPinned) return; // 핀이 아닐 땐 섹션 스크롤을 방해하지 않음

            // 동적 touch-action (중간 슬라이드일 때만 스크롤 차단 강화)
            function applyTouchAction() {
                secEl.style.touchAction = isMiddle(swiper) ? "none" : "auto";
            }
            applyTouchAction();

            // ========== WHEEL ==========
            secEl.__wheelHandler = function (e) {
                const oe = e; // native
                const dy = normWheelDelta(oe);

                // 중간 슬라이드면 페이지 스크롤은 항상 차단
                if (isMiddle(swiper)) e.preventDefault();

                if (isBusy() || dy === 0) return;

                wheelAcc += dy;
                if (Math.abs(wheelAcc) < WHEEL_ACTIVATION) return;

                const dirDown = wheelAcc > 0;
                wheelAcc = 0;

                if (dirDown) {
                    if (swiper.isEnd) {
                        // 마지막이면 아래로는 통과 (차단하지 않음)
                        return;
                    }
                    e.preventDefault();
                    swiper.slideNext(speed);
                } else {
                    if (swiper.isBeginning) {
                        // 처음이면 위로는 통과
                        return;
                    }
                    e.preventDefault();
                    swiper.slidePrev(speed);
                }
                // 전환 끝나면 touch-action 재평가
                swiper.once("slideChangeTransitionEnd", applyTouchAction);
            };
            // passive:false 로 반드시 등록
            secEl.addEventListener("wheel", secEl.__wheelHandler, { passive: false });

            // ========== TOUCH ==========
            $section.on("touchstart" + NS, function (e) {
                const t = e.originalEvent.touches && e.originalEvent.touches[0];
                tStartY = t ? t.clientY : 0;
                touchAcc = 0;
            });

            secEl.__touchMoveHandler = function (e) {
                const t = e.touches && e.touches[0];
                if (!t || isBusy()) return;

                const dy = tStartY - t.clientY; // 양수: 아래로 드래그
                // 중간 슬라이드면 항상 차단 시도
                if (isMiddle(swiper)) e.preventDefault();

                touchAcc += dy;
                if (Math.abs(touchAcc) < TOUCH_ACTIVATION) return;

                const dirDown = touchAcc > 0;
                touchAcc = 0;
                tStartY = t.clientY;

                if (dirDown) {
                    if (swiper.isEnd) return; // 통과
                    e.preventDefault();
                    swiper.slideNext(speed);
                } else {
                    if (swiper.isBeginning) return; // 통과
                    e.preventDefault();
                    swiper.slidePrev(speed);
                }
                swiper.once("slideChangeTransitionEnd", applyTouchAction);
            };
            secEl.addEventListener("touchmove", secEl.__touchMoveHandler, { passive: false });

            // ========== KEYBOARD (옵션) ==========
            $section.attr("tabindex", "-1").on("keydown" + NS, function (e) {
                if (!isOverviewPinned || isBusy()) return;

                const downKeys = ["ArrowDown", "PageDown", " ", "Spacebar"];
                const upKeys = ["ArrowUp", "PageUp"];

                if (isMiddle(swiper) && (downKeys.includes(e.key) || upKeys.includes(e.key))) {
                    e.preventDefault();
                }

                if (downKeys.includes(e.key)) {
                    if (swiper.isEnd) return;
                    e.preventDefault();
                    swiper.slideNext(speed);
                } else if (upKeys.includes(e.key)) {
                    if (swiper.isBeginning) return;
                    e.preventDefault();
                    swiper.slidePrev(speed);
                }
                swiper.once("slideChangeTransitionEnd", applyTouchAction);
            });

            // 언락 저장 (기존 구조 유지)
            const unlock = function () {
                $section.off("touchstart" + NS).off("keydown" + NS);
                if (secEl.__wheelHandler) {
                    secEl.removeEventListener("wheel", secEl.__wheelHandler);
                    secEl.__wheelHandler = null;
                }
                if (secEl.__touchMoveHandler) {
                    secEl.removeEventListener("touchmove", secEl.__touchMoveHandler);
                    secEl.__touchMoveHandler = null;
                }
                secEl.style.touchAction = ""; // 복원
            };
            unlock.swiper = swiper;
            sectionLocks.set($section[0], unlock);
        }

        // --------------------------------------------
        // Init
        // --------------------------------------------
        $(function () {
            $(".sub_visual").each(function () {
                const $host = $(this);
                const $section = $host.closest("section").length ? $host.closest("section") : $host;
                const $container = $host.find(".sub_visual_content");
                const $titlesWrap = $host.find(".sub_titles_wrap");
                const $indicators = $titlesWrap.find(".sub_tilte_wrap");
                if (!$container.length || !$indicators.length) return;

                const slideEls = upgradeToSwiperDOM($container);
                decorateIndicatorsA11y($titlesWrap, $indicators, slideEls);

                const swiper = new Swiper($container.get(0), {
                    direction: "vertical",
                    effect: "slide",
                    speed: 600,
                    allowTouchMove: false, // 제스처는 막고, 휠/터치로만 넘김
                    loop: false,
                    mousewheel: false,
                    observeParents: true,
                    observer: true,
                    resistanceRatio: 0,
                    touchReleaseOnEdges: true,
                    on: {
                        afterInit(sw) {
                            fadeSetIndicator($indicators, getActiveIndex(sw), true);
                        },
                        slideChange(sw) {
                            fadeSetIndicator($indicators, getActiveIndex(sw));
                        },
                    },
                });

                // 섹션 단위로 락 세팅 (현 pin 상태에 따라 즉시/대기)
                sectionLocks.set($section[0], function () {});
                sectionLocks.get($section[0]).swiper = swiper;
                if (isOverviewPinned) lockScrollToSlides($section, swiper);

                // ScrollTrigger가 refresh로 레이아웃 재계산 시 바인딩도 갱신
                ScrollTrigger.addEventListener("refresh", () => {
                    sectionLocks.get($section[0])?.(); // 언락
                    if (isOverviewPinned) lockScrollToSlides($section, swiper);
                });
            });
        });
    })();

    /* =========================================================
     * 3) project Swiper - gsap (핀 고정) + Swiper
     * =======================================================*/
    const ani3 = gsap.timeline();

    ScrollTrigger.create({
        animation: ani3,
        trigger: "#project_wrap",
        start: "top top",
        end: "+=700",
        scrub: true,
        pin: true,
        anticipatePin: 1,
        markers: false,
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
                end: "+=700",
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
            end: "+=700",
            scrub: true,
            pin: true,
            anticipatePin: 1,
            markers: false,
        });
    });

    mm.add("(max-width: 720px)", () => {
        const ani4 = gsap.timeline();

        ScrollTrigger.create({
            animation: ani4,
            trigger: "#tec",
            start: "top top",
            end: "+=700",
            scrub: true,
            pin: false,
            anticipatePin: 1,
            markers: false,
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

// 반응형 이미지 / 영상 변경
$(function () {
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
            updateMainVisual(); // 가로폭이 달라졌을 때만 호출
            lastWidth = currentWidth; // 이전 폭 갱신
        }
    });
});

// 모바일에서 로딩시 헤더 움직이지 않는 문제 해결용
document.head.insertAdjacentHTML("beforeend", `<style>header{opacity:1;}</style>`);
