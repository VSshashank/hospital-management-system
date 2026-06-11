// HealthConnect Website JavaScript - Production Ready
// Version: 2.0.0

(function() {
    'use strict';

    // Development mode detection
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Logging utilities
    const devLog = (...args) => isDev && console.log(...args);
    const devWarn = (...args) => isDev && console.warn(...args);
    const devError = (...args) => isDev && console.error(...args);

    // Constants
    const CONSTANTS = {
        SCROLL_THRESHOLD: 50,
        BACK_TO_TOP_THRESHOLD: 300,
        EXIT_INTENT_DELAY: 60000,
        EXIT_INTENT_THRESHOLD: 5,
        SCROLLSPY_OFFSET: 100
    };

    // DOM Elements Cache
    const elements = {
        loadingSpinner: document.getElementById('loading-spinner'),
        themeToggleBtn: document.getElementById('themeToggle'),
        mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
        mobileNav: document.querySelector('.mobile-nav'),
        mobileNavClose: document.querySelector('.mobile-nav-close'),
        mobileNavOverlay: document.querySelector('.mobile-nav-overlay'),
        backToTopBtn: document.getElementById('backToTop'),
        header: document.querySelector('.header'),
        cookieConsent: document.getElementById('cookie-consent'),
        cookieAcceptBtn: document.getElementById('cookie-accept'),
        cookieDeclineBtn: document.getElementById('cookie-decline'),
        cookieDismissBtn: document.getElementById('cookie-dismiss'),
        leadModal: document.getElementById('leadModal'),
        requestDemoBtn: document.getElementById('requestDemoBtn'),
        getStartedBtn: document.getElementById('getStartedBtn'),
        learnMoreBtn: document.getElementById('learnMoreBtn'),
        modalClose: document.getElementById('modalClose'),
        leadForm: document.getElementById('leadForm'),
        successMessage: document.getElementById('successMessage'),
        closeSuccessBtn: document.getElementById('closeSuccessBtn'),
        tourBtn: document.getElementById('tourBtn'),
        mobileDemoBtn: document.getElementById('mobileDemoBtn')
    };

    // State
    let exitIntentShown = false;
    const pageLoadTime = Date.now();

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        try {
            initializeIcons();
            setupEventListeners();
            initializeComponents();
            hideLoadingSpinner();
            applySavedTheme();
            showCookieConsentIfNeeded();
            updateCopyrightYear();
            devLog('✅ HealthConnect initialized successfully');
        } catch (error) {
            devError('❌ Initialization error:', error);
            // Graceful degradation - site still works
            hideLoadingSpinner();
        }
    }

    // ============================================
    // ICONS
    // ============================================
    function initializeIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            lucide.createIcons();
        } else {
            devWarn('⚠️ Lucide icons not available');
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        // Theme
        elements.themeToggleBtn?.addEventListener('click', toggleTheme);
        
        // Mobile nav
        elements.mobileMenuToggle?.addEventListener('click', openMobileNav);
        elements.mobileNavClose?.addEventListener('click', closeMobileNav);
        elements.mobileNavOverlay?.addEventListener('click', closeMobileNav);
        
        // Navigation links
        document.querySelectorAll('.mobile-nav-links a, .mobile-bottom-nav a').forEach(link => {
            link.addEventListener('click', handleMobileNavClick);
        });
        
        // Back to top
        elements.backToTopBtn?.addEventListener('click', scrollToTop);
        
        // Scroll
        window.addEventListener('scroll', throttle(handleScroll, 16));
        
        // Cookie consent
        elements.cookieAcceptBtn?.addEventListener('click', handleCookieAccept);
        elements.cookieDeclineBtn?.addEventListener('click', handleCookieDecline);
        elements.cookieDismissBtn?.addEventListener('click', handleCookieDismiss);
        
        // Modal
        elements.requestDemoBtn?.addEventListener('click', openModal);
        elements.getStartedBtn?.addEventListener('click', openModal);
        elements.learnMoreBtn?.addEventListener('click', () => {
            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
        });
        elements.modalClose?.addEventListener('click', closeModal);
        elements.closeSuccessBtn?.addEventListener('click', closeModal);
        elements.leadModal?.addEventListener('click', handleModalOverlayClick);
        
        // Tour
        elements.tourBtn?.addEventListener('click', startProductTour);
        elements.mobileDemoBtn?.addEventListener('click', startProductTour);
        
        // Form
        elements.leadForm?.addEventListener('submit', handleFormSubmit);
        
        // Use cases
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', handleRoleToggle);
        });
        
        // FAQ
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', handleFaqToggle);
        });
        
        // Exit intent
        document.addEventListener('mouseout', handleExitIntent);
        
        // Window events
        window.addEventListener('resize', throttle(handleResize, 250));
        window.addEventListener('beforeunload', cleanup);
        
        // Global error handling
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
    }

    // ============================================
    // COMPONENTS
    // ============================================
    function initializeComponents() {
        initFormValidation();
        initIntersectionObservers();
        initDashboardEffects();
        initTimelineSVG();
    }

    function initTimelineSVG() {
        if (window.innerWidth <= 768) return;
        const path = document.querySelector('#timeline-svg path');
        if (path) {
            const length = path.getTotalLength();
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
        }
    }

    // ============================================
    // LOADING SPINNER
    // ============================================
    function hideLoadingSpinner() {
        if (elements.loadingSpinner) {
            setTimeout(() => elements.loadingSpinner.classList.add('hidden'), 500);
        }
    }

    // ============================================
    // COPYRIGHT
    // ============================================
    function updateCopyrightYear() {
        const el = document.getElementById('copyright-year');
        if (el) el.textContent = `© ${new Date().getFullYear()} HealthConnect. All rights reserved.`;
    }

    // ============================================
    // THEME
    // ============================================
    function applySavedTheme() {
        const saved = getCookie('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    }

    function toggleTheme() {
        const current = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = current === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        setCookie('theme', newTheme, 365);
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark-mode', isDark);
        document.body.classList.toggle('dark-mode', isDark);
        
        if (elements.themeToggleBtn) {
            elements.themeToggleBtn.innerHTML = `<i data-lucide="${isDark ? 'moon' : 'sun'}"></i>`;
            elements.themeToggleBtn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
            elements.themeToggleBtn.setAttribute('aria-pressed', isDark);
        }
        
        initializeIcons();
    }

    // ============================================
    // MOBILE NAV
    // ============================================
    function openMobileNav() {
        elements.mobileNav?.classList.add('active');
        elements.mobileNavOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
        elements.mobileMenuToggle?.setAttribute('aria-expanded', 'true');
    }

    function closeMobileNav() {
        elements.mobileNav?.classList.remove('active');
        elements.mobileNavOverlay?.classList.remove('active');
        document.body.style.overflow = '';
        elements.mobileMenuToggle?.setAttribute('aria-expanded', 'false');
    }

    function handleMobileNavClick(e) {
        const href = e.currentTarget.getAttribute('href');
        if (href?.startsWith('#')) {
            e.preventDefault();
            closeMobileNav();
            setTimeout(() => {
                document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }

    // ============================================
    // SCROLL
    // ============================================
    function handleScroll() {
        const scrollY = window.scrollY;
        
        // Header
        elements.header?.classList.toggle('scrolled', scrollY > CONSTANTS.SCROLL_THRESHOLD);
        
        // Back to top
        elements.backToTopBtn?.classList.toggle('visible', scrollY > CONSTANTS.BACK_TO_TOP_THRESHOLD);
        
        // Scrollspy
        updateActiveNavLink();
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-links a');
        let current = '';
        
        sections.forEach(section => {
            const top = section.offsetTop - CONSTANTS.SCROLLSPY_OFFSET;
            if (window.scrollY >= top && window.scrollY < top + section.clientHeight) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            const isActive = link.getAttribute('href') === `#${current}`;
            link.classList.toggle('active', isActive);
            link.toggleAttribute('aria-current', isActive);
        });
    }

    // ============================================
    // COOKIES
    // ============================================
    function showCookieConsentIfNeeded() {
        if (!getCookie('cookieConsent') && elements.cookieConsent) {
            setTimeout(() => elements.cookieConsent.classList.add('show'), 1000);
        }
    }

    function handleCookieAccept() {
        setCookie('cookieConsent', 'accepted', 365);
        elements.cookieConsent?.classList.remove('show');
        devLog('🍪 Cookies accepted');
    }

    function handleCookieDecline() {
        setCookie('cookieConsent', 'declined', 365);
        elements.cookieConsent?.classList.remove('show');
        devLog('🍪 Cookies declined');
    }

    function handleCookieDismiss() {
        elements.cookieConsent?.classList.remove('show');
    }

    // ============================================
    // MODAL
    // ============================================
    function openModal() {
        if (getCookie('dontShowModal') === 'true') return;
        
        elements.leadModal?.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            elements.leadModal?.querySelector('input')?.focus();
        }, 100);
    }

    function closeModal() {
        elements.leadModal?.classList.remove('active');
        document.body.style.overflow = '';
        
        if (elements.successMessage) elements.successMessage.classList.remove('active');
        if (elements.leadForm) elements.leadForm.style.display = 'block';
        
        resetFormState();
    }

    function handleModalOverlayClick(e) {
        if (e.target === elements.leadModal) {
            const hasContent = Array.from(new FormData(elements.leadForm).values())
                .some(v => v.trim() !== '');
            
            if (!hasContent || confirm('You have unsaved changes. Close anyway?')) {
                closeModal();
            }
        }
    }

    // ============================================
    // FORM
    // ============================================
    function initFormValidation() {
        const form = elements.leadForm;
        if (!form) return;
        
        const fields = {
            email: form.querySelector('#workEmail'),
            company: form.querySelector('#companyName'),
            name: form.querySelector('#fullName'),
            role: form.querySelector('#role')
        };
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        
        // Real-time validation
        fields.email?.addEventListener('input', debounce(() => validateField(fields.email, validateEmail), 300));
        fields.company?.addEventListener('input', debounce(() => validateField(fields.company, validateCompany), 300));
        fields.name?.addEventListener('input', debounce(() => validateField(fields.name, validateName), 300));
        fields.role?.addEventListener('change', () => validateField(fields.role, validateRole));
        
        // Update submit button
        form.addEventListener('input', debounce(() => {
            const allValid = Object.values(fields).every(f => f?.value.trim());
            submitBtn.disabled = !allValid;
        }, 300));
    }

    function validateField(field, validator) {
        const result = validator(field.value.trim());
        
        if (result.valid) {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
            field.parentNode.querySelector('.error-message')?.remove();
        } else {
            field.classList.add('is-invalid');
            field.classList.remove('is-valid');
            
            const existing = field.parentNode.querySelector('.error-message');
            if (existing) existing.remove();
            
            const error = document.createElement('span');
            error.className = 'error-message';
            error.setAttribute('role', 'alert');
            error.textContent = result.message;
            field.parentNode.appendChild(error);
        }
        
        return result.valid;
    }

    function validateEmail(value) {
        if (!value) return { valid: false, message: 'Email is required' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return { valid: false, message: 'Please enter a valid email' };
        }
        return { valid: true };
    }

    function validateCompany(value) {
        if (!value) return { valid: false, message: 'Company name is required' };
        if (value.length < 2) return { valid: false, message: 'Too short' };
        return { valid: true };
    }

    function validateName(value) {
        if (!value) return { valid: false, message: 'Name is required' };
        if (value.length < 2) return { valid: false, message: 'Too short' };
        return { valid: true };
    }

    function validateRole(value) {
        if (!value) return { valid: false, message: 'Please select a role' };
        return { valid: true };
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Submitting...';
        
        // Simulate API call
        setTimeout(() => {
            elements.leadForm.style.display = 'none';
            elements.successMessage.classList.add('active');
            
            btn.disabled = false;
            btn.textContent = 'Request Demo';
            
            setCookie('leadFormSubmitted', 'true', 7);
            resetFormState();
            
            devLog('✅ Form submitted');
        }, 1500);
    }

    function resetFormState() {
        elements.leadForm?.reset();
        document.querySelectorAll('.form-control').forEach(field => {
            field.classList.remove('is-valid', 'is-invalid');
            field.parentNode.querySelector('.error-message')?.remove();
        });
    }

    // ============================================
    // USE CASES & FAQ
    // ============================================
    function handleRoleToggle(e) {
        const role = e.currentTarget.getAttribute('data-role');
        
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        e.currentTarget.classList.add('active');
        e.currentTarget.setAttribute('aria-selected', 'true');
        
        document.querySelectorAll('.content-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${role}-panel`)?.classList.add('active');
    }

    function handleFaqToggle(e) {
        const question = e.currentTarget;
        const answer = question.nextElementSibling;
        const isExpanded = question.getAttribute('aria-expanded') === 'true';
        
        // Close all
        document.querySelectorAll('.faq-question').forEach(q => {
            if (q !== question) {
                q.setAttribute('aria-expanded', 'false');
                q.nextElementSibling.style.maxHeight = null;
            }
        });
        
        // Toggle current
        question.setAttribute('aria-expanded', !isExpanded);
        answer.style.maxHeight = !isExpanded ? answer.scrollHeight + 'px' : null;
    }

    // ============================================
    // DASHBOARD EFFECTS
    // ============================================
    function initDashboardEffects() {
        const dashboard = document.querySelector('.dashboard-mockup');
        if (!dashboard) return;
        
        let isHover = false;
        
        dashboard.addEventListener('mouseenter', () => isHover = true);
        dashboard.addEventListener('mouseleave', () => {
            isHover = false;
            dashboard.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
        
        dashboard.addEventListener('mousemove', throttle((e) => {
            if (!isHover) return;
            
            const rect = dashboard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateY = ((x - centerX) / centerX) * 5;
            const rotateX = ((centerY - y) / centerY) * 5;
            
            dashboard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
        }, 16));
    }

    // ============================================
    // INTERSECTION OBSERVERS
    // ============================================
    function initIntersectionObservers() {
        // Stats counter
        const stats = document.querySelector('.stats');
        if (stats) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    initStatsCounter();
                    observer.unobserve(stats);
                }
            }, { threshold: 0.5 });
            observer.observe(stats);
        }
        
        // Timeline
        const timeline = document.querySelector('.how-it-works');
        if (timeline) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    animateTimeline();
                    observer.unobserve(timeline);
                }
            }, { threshold: 0.3 });
            observer.observe(timeline);
        }
    }

    function initStatsCounter() {
        document.querySelectorAll('.stat-number').forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const increment = target / 200;
            let current = 0;
            
            const update = () => {
                if (current < target) {
                    current += increment;
                    counter.textContent = Math.ceil(current).toLocaleString();
                    requestAnimationFrame(update);
                } else {
                    counter.textContent = target.toLocaleString();
                }
            };
            update();
        });
    }

    function animateTimeline() {
        const path = document.querySelector('#timeline-svg path');
        if (path) {
            path.classList.add('is-drawing');
            path.style.strokeDashoffset = '0';
        }
    }

    // ============================================
    // PRODUCT TOUR (FIXED!)
    // ============================================
    function startProductTour() {
        // CRITICAL FIX: Correct Driver.js initialization
        if (!window.driver || typeof window.driver !== 'function') {
            devWarn('⚠️ Driver.js not available');
            alert('Product tour unavailable. Please refresh and try again.');
            return;
        }
        
        try {
            const driverObj = window.driver({
                showProgress: true,
                steps: [
                    {
                        element: '.hero-content',
                        popover: {
                            title: 'Welcome to HealthConnect',
                            description: 'Your unified healthcare platform.',
                            side: 'bottom'
                        }
                    },
                    {
                        element: '.trust-indicators',
                        popover: {
                            title: 'Trusted by Thousands',
                            description: 'Join 487K+ patients and 12K+ providers.',
                            side: 'bottom'
                        }
                    },
                    {
                        element: '#features',
                        popover: {
                            title: 'Platform for Everyone',
                            description: 'Tailored for patients, providers, and insurers.',
                            side: 'top'
                        }
                    }
                ]
            });
            
            driverObj.drive();
        } catch (error) {
            devError('❌ Tour error:', error);
            alert('Unable to start tour.');
        }
    }

    // ============================================
    // EXIT INTENT
    // ============================================
    function handleExitIntent(e) {
        if (exitIntentShown || 
            Date.now() - pageLoadTime < CONSTANTS.EXIT_INTENT_DELAY ||
            getCookie('dontShowModal') === 'true') return;
        
        if (e.clientY <= CONSTANTS.EXIT_INTENT_THRESHOLD && e.relatedTarget === null) {
            exitIntentShown = true;
            openModal();
        }
    }

    // ============================================
    // UTILITIES
    // ============================================
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // ============================================
    // ERROR HANDLING
    // ============================================
    function handleGlobalError(event) {
        devError('❌ Global error:', event.error);
        // In production, send to error tracking service (Sentry, etc.)
    }

    function handleUnhandledRejection(event) {
        devError('❌ Unhandled rejection:', event.reason);
        event.preventDefault();
    }

    function handleResize() {
        if (window.innerWidth > 768) closeMobileNav();
        initTimelineSVG();
    }

    function cleanup() {
        devLog('🧹 Cleanup');
    }

    // ============================================
    // SERVICE WORKER
    // ============================================
    if ('serviceWorker' in navigator && !isDev) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => devLog('✅ SW registered'))
                .catch(err => devWarn('⚠️ SW failed:', err));
        });
    }

    // ============================================
    // START
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();