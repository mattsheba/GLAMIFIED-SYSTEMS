/**
 * Glamified Systems - Main JavaScript
 * Requires jQuery (loaded before this file)
 */
(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();

    // Initiate the wowjs
    if (typeof WOW !== 'undefined') {
        new WOW().init();
    }

    // ============================================
    // SCROLL HANDLER (throttled with rAF)
    // ============================================

    var scrollTicking = false;
    $(window).on('scroll', function () {
        if (!scrollTicking) {
            window.requestAnimationFrame(function () {
                var scrollTop = $(window).scrollTop();

                // Back to top button
                if (scrollTop > 300) {
                    $('.back-to-top').fadeIn('slow');
                } else {
                    $('.back-to-top').fadeOut('slow');
                }

                // Sticky Header
                if (scrollTop > 100) {
                    $('.navbar').addClass('fixed-top shadow');
                    $('body').addClass('has-sticky-header');
                } else {
                    $('.navbar').removeClass('fixed-top shadow');
                    $('body').removeClass('has-sticky-header');
                }

                scrollTicking = false;
            });
            scrollTicking = true;
        }
    });

    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });

    // ============================================
    // DOCUMENT READY (consolidated)
    // ============================================

    $(document).ready(function() {
        // Auto-add main-content ID if missing
        if ($('#main-content').length === 0) {
            var $pageHeader = $('.page-header');
            if ($pageHeader.length) {
                var $firstContent = $pageHeader.next('.container-fluid, .container');
                if ($firstContent.length) {
                    $firstContent.attr('id', 'main-content');
                } else {
                    $('body').attr('id', 'main-content');
                }
            } else {
                var $firstContent = $('.navbar').next('.container-fluid, .container');
                if ($firstContent.length) {
                    $firstContent.attr('id', 'main-content');
                }
            }
        }

        // Fact Counter
        $('.counter-value').each(function(){
            $(this).prop('Counter',0).animate({
                Counter: $(this).text()
            },{
                duration: 2000,
                easing: 'easeInQuad',
                step: function (now){
                    $(this).text(Math.ceil(now));
                }
            });
        });

        // Track payment button clicks
        $('.payment-btn').on('click', function(e) {
            var service = $(this).closest('.pricing-card').find('h4').text().trim();
            var amount = $(this).closest('.pricing-card').find('.price').text().trim();

            try {
                localStorage.setItem('pending_payment', JSON.stringify({
                    service: service,
                    amount: amount,
                    timestamp: new Date().toISOString(),
                    url: $(this).attr('href')
                }));
            } catch (e) {
                // localStorage may be unavailable
            }
        });

        // Check for returning customers with pending payments
        try {
            var pendingPayment = localStorage.getItem('pending_payment');
            if (pendingPayment) {
                pendingPayment = JSON.parse(pendingPayment);
                var hoursSince = (new Date() - new Date(pendingPayment.timestamp)) / (1000 * 60 * 60);

                if (hoursSince < 2) {
                    // Customer has a pending payment - could show a reminder
                }
            }
        } catch (e) {
            // localStorage may be unavailable
        }

        // Payment success detection (if returning from payment portal)
        if (window.location.search.includes('payment_success')) {
            showPaymentSuccessMessage();
            try {
                localStorage.removeItem('pending_payment');
            } catch (e) {
                // localStorage may be unavailable
            }
        }
    });

    // ============================================
    // FORM HANDLING
    // ============================================

    $('form').on('submit', function(e) {
        var $form = $(this);
        var $submitBtn = $form.find('button[type="submit"]');
        
        // Basic validation
        var isValid = true;
        $form.find('input[required], textarea[required]').each(function() {
            if ($(this).val().trim() === '') {
                $(this).addClass('is-invalid');
                isValid = false;
            } else {
                $(this).removeClass('is-invalid');
            }
        });
        
        if (!isValid) {
            e.preventDefault();
            $form.find('.is-invalid').first().focus();
            return false;
        }
        
        // Add loading state
        $submitBtn.prop('disabled', true).addClass('btn-loading');
        
        return true;
    });

    // Remove loading state if form resets
    $('form').on('reset', function() {
        $(this).find('button[type="submit"]').prop('disabled', false).removeClass('btn-loading');
    });

    // Real-time validation
    $('input[required], textarea[required]').on('input blur', function() {
        if ($(this).val().trim() === '') {
            $(this).addClass('is-invalid');
        } else {
            $(this).removeClass('is-invalid');
        }
    });

    // ============================================
    // SMOOTH SCROLLING
    // ============================================

    $('a[href^="#"]').not('[href="#"]').on('click', function(e) {
        e.preventDefault();
        var target = $(this.getAttribute('href'));
        if (target.length) {
            var headerHeight = $('.navbar').outerHeight() || 70;
            $('html, body').stop().animate({
                scrollTop: target.offset().top - headerHeight
            }, 1000, 'easeInOutExpo');
        }
    });

    // ============================================
    // COOKIE CONSENT
    // ============================================

    try {
        if (!localStorage.getItem('cookies-accepted')) {
            setTimeout(function() {
                $('body').append(`
                    <div class="cookie-consent alert alert-info fixed-bottom m-0 rounded-0">
                        <div class="container">
                            <div class="d-flex align-items-center justify-content-between">
                                <p class="mb-0">
                                    We use cookies to improve your experience on our website. 
                                    By continuing to browse, you agree to our use of cookies.
                                </p>
                                <div class="ms-3">
                                    <button class="btn btn-sm btn-primary" id="accept-cookies">
                                        Accept
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary ms-2" id="learn-more-cookies">
                                        Learn More
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
                
                $('#accept-cookies').on('click', function() {
                    try {
                        localStorage.setItem('cookies-accepted', 'true');
                    } catch (e) {
                        // localStorage may be unavailable
                    }
                    $('.cookie-consent').fadeOut(300, function() {
                        $(this).remove();
                    });
                });
                
                $('#learn-more-cookies').on('click', function() {
                    window.location.href = 'privacy-policy.html';
                });
            }, 1000);
        }
    } catch (e) {
        // localStorage may be unavailable
    }

    // ============================================
    // PAYMENT SUCCESS MODAL
    // ============================================

    function showPaymentSuccessMessage() {
        $('body').append(`
            <div class="modal fade" id="paymentSuccessModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title"><i class="fas fa-check-circle me-2"></i>Payment Successful!</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center py-4">
                            <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                            <h4>Thank You for Your Payment</h4>
                            <p class="mb-0">We've received your payment and will contact you within 24 hours to begin your service.</p>
                        </div>
                        <div class="modal-footer">
                            <a href="contact.html" class="btn btn-primary">Contact Us</a>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        $('#paymentSuccessModal').modal('show');
    }

    // ============================================
    // MOBILE MENU CLOSE ON CLICK
    // ============================================

    $('.navbar-nav .nav-link').on('click', function() {
        if ($(window).width() < 992) {
            $('.navbar-collapse').collapse('hide');
        }
    });

})(jQuery);