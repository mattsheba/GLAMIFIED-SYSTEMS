<!-- Add this BEFORE your main.js file -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="js/main.js"></script>
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

    // Auto-add main-content ID if missing
$(document).ready(function() {
    if ($('#main-content').length === 0) {
        // Find the first content section after the page header
        var $pageHeader = $('.page-header');
        if ($pageHeader.length) {
            var $firstContent = $pageHeader.next('.container-fluid, .container');
            if ($firstContent.length) {
                $firstContent.attr('id', 'main-content');
            } else {
                // Fallback: add to body
                $('body').attr('id', 'main-content');
            }
        } else {
            // No page header found
            var $firstContent = $('.navbar').next('.container-fluid, .container');
            if ($firstContent.length) {
                $firstContent.attr('id', 'main-content');
            }
        }
    }
});
    
    // Initiate the wowjs
    if (typeof WOW !== 'undefined') {
        new WOW().init();
    }
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
        
        // Sticky Header
        if ($(window).scrollTop() > 100) {
            $('.navbar').addClass('fixed-top shadow');
            $('body').addClass('has-sticky-header');
        } else {
            $('.navbar').removeClass('fixed-top shadow');
            $('body').removeClass('has-sticky-header');
        }
    });
    
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });

    // Fact Counter
    $(document).ready(function(){
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
        
        // For Formspree forms, let them handle submission
        // Loading state will reset on page reload after submission
        
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
    // WHATSAPP ANALYTICS
    // ============================================

    $('.whatsapp-float').on('click', function() {
        // You can add Google Analytics tracking here
        // Example: gtag('event', 'whatsapp_click', { 'event_category': 'Contact' });
        console.log('WhatsApp button clicked - message: ' + $(this).attr('href'));
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
                localStorage.setItem('cookies-accepted', 'true');
                $('.cookie-consent').fadeOut(300, function() {
                    $(this).remove();
                });
            });
            
            $('#learn-more-cookies').on('click', function() {
                // Redirect to privacy policy or show modal
                window.location.href = 'privacy-policy.html'; // Create this page
            });
        }, 1000); // Show after 1 second
    }

    // ============================================
    // PRICING CARD INTERACTIONS
    // ============================================

    $('.pricing-card').on('click', function() {
        var packageName = $(this).find('h4').text();
        // Track package interest
        console.log('Package interest:', packageName);
        // Optional: Scroll to contact form
        // $('html, body').animate({
        //     scrollTop: $('#contact-form').offset().top - 100
        // }, 800);
    });

    // Payment tracking and analytics
$(document).ready(function() {
    // Track payment button clicks
    $('.payment-btn').on('click', function(e) {
        var service = $(this).closest('.pricing-card').find('h4').text().trim();
        var amount = $(this).closest('.pricing-card').find('.price').text().trim();
        
        // Store in localStorage for follow-up
        localStorage.setItem('pending_payment', JSON.stringify({
            service: service,
            amount: amount,
            timestamp: new Date().toISOString(),
            url: $(this).attr('href')
        }));
        
        // Optional: Google Analytics event
        // gtag('event', 'payment_initiated', {
        //     'event_category': 'Payment',
        //     'event_label': service,
        //     'value': parseInt(amount.replace(/[^0-9]/g, ''))
        // });
        
        console.log('Payment initiated:', service, amount);
    });
    
    // Check for returning customers with pending payments
    var pendingPayment = localStorage.getItem('pending_payment');
    if (pendingPayment) {
        pendingPayment = JSON.parse(pendingPayment);
        var hoursSince = (new Date() - new Date(pendingPayment.timestamp)) / (1000 * 60 * 60);
        
        if (hoursSince < 2) { // Within 2 hours
            console.log('Customer has a pending payment from', Math.round(hoursSince * 60), 'minutes ago');
            // You could show a "Complete your payment" message
        }
    }
    
    // Payment success detection (if returning from payment portal)
    if (window.location.search.includes('payment_success')) {
        showPaymentSuccessMessage();
        localStorage.removeItem('pending_payment');
    }
});

function showPaymentSuccessMessage() {
    // Create success modal
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
    // IMAGE LAZY LOADING FALLBACK
    // ============================================

    if (!('loading' in HTMLImageElement.prototype)) {
        // Load a polyfill or implement Intersection Observer
        var lazyImages = $('img[loading="lazy"]');
        if (lazyImages.length) {
            console.log('Consider adding lazy loading polyfill for', lazyImages.length, 'images');
        }
    }

    // ============================================
    // MOBILE MENU CLOSE ON CLICK
    // ============================================

    $('.navbar-nav .nav-link').on('click', function() {
        if ($(window).width() < 992) {
            $('.navbar-collapse').collapse('hide');
        }
    });

    // ============================================
    // WHATSAPP BUTTON PULSE ANIMATION
    // ============================================

    setInterval(function() {
        $('.whatsapp-float').toggleClass('pulse');
    }, 2000);

    // Add pulse class definition
    $('<style>').text('.pulse { animation: pulse 2s infinite; } @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(37, 211, 102, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); } }').appendTo('head');

})(jQuery);