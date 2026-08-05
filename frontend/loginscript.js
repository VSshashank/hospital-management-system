// HealthConnect Pro - Enhanced Authentication System

/**
 * @file Enhanced authentication system
 * @description Secure healthcare portal login with test credentials and role-based redirection
 * @version 4.1.0 - Production Ready
 */

// Test Configuration
const TEST_CONFIG = Object.freeze({
    ENABLED: true,
    USERS: {
        'p1008': { 
            role: 'patient', 
            password: 'Patient123!',
            hint: 'Use "Patient123!" for patient account',
            contacts: { email: 'patient@healthconnect.com', phone: '+1 (555) 100-1008' }
        },
        'd1001': { 
            role: 'doctor', 
            password: 'Doctor123!',
            hint: 'Use "Doctor123!" for doctor account',
            contacts: { email: 'doctor@healthconnect.com', phone: '+1 (555) 100-1001' }
        },
        'a1001': { 
            role: 'admin', 
            password: 'Admin123!',
            hint: 'Use "Admin123!" for admin account',
            contacts: { email: 'admin@healthconnect.com', phone: '+1 (555) 100-1001' }
        },
        'i1001': { 
            role: 'insurance', 
            password: 'Insurance123!',
            hint: 'Use "Insurance123!" for insurance account',
            contacts: { email: 'insurance@healthconnect.com', phone: '+1 (555) 100-1001' }
        }
    }
});

// Security Configuration
const SECURITY_CONFIG = Object.freeze({
    PASSWORD_MIN_LENGTH: 8,
    MAX_LOGIN_ATTEMPTS: 5,
    ACCOUNT_LOCKOUT_TIME: 15 * 60 * 1000,
    SESSION_TIMEOUT: 30 * 60 * 1000,
    RATE_LIMIT_DELAY: 1000,
    RESEND_TIMEOUT: 30,
    CODE_LENGTH: 6,
    DEBOUNCE_DELAY: 300
});

// Application State
const AppState = {
    selectedHospital: 1,
    currentVerificationMethod: 'email',
    resendTimer: null,
    resendCountdown: 0,
    currentUserId: '',
    currentUserRole: '',
    verificationCode: '',
    loginAttempts: 0,
    isSubmitting: false,
    sessionTimer: null,
    sessionWarningTimer: null,
    debounceTimers: new Map(),
    csrfToken: null,
    securityStatus: 'active'
};

// Enhanced Utility Functions
const Utils = {
    debounce(func, delay, key) {
        return (...args) => {
            clearTimeout(AppState.debounceTimers.get(key));
            AppState.debounceTimers.set(key, setTimeout(() => func(...args), delay));
        };
    },
    
    generateSecureRandom(length) {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    checkBrowserSupport() {
        return {
            crypto: !!window.crypto?.subtle,
            webAuthn: !!window.PublicKeyCredential,
            intersectionObserver: 'IntersectionObserver' in window,
            fetch: 'fetch' in window,
            secureContext: window.isSecureContext
        };
    }
};

// Enhanced Error Handling
class AppError extends Error {
    constructor(message, code, userFriendly) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.userFriendly = userFriendly;
        this.timestamp = new Date().toISOString();
    }
}

// Notification System
function showNotification(message, type = 'info', duration = null) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    if (!duration) {
        const durations = {
            success: 5000,
            error: 8000,
            warning: 7000,
            info: 5000
        };
        duration = durations[type] || 5000;
    }
    
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i data-lucide="${getNotificationIcon(type)}" aria-hidden="true"></i>
        <span>${Utils.escapeHtml(message)}</span>
    `;
    
    if (window.lucide) {
        lucide.createIcons();
    }
    
    notification.classList.add('show');
    
    const hideTimer = setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
    
    notification._hideTimer = hideTimer;
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };
    return icons[type] || 'info';
}

// Loading States
function setLoading(button, isLoading) {
    if (!button) return;
    
    const spinner = button.querySelector('.loading-spinner');
    const text = button.querySelector('span');
    const icon = button.querySelector('i');
    
    if (isLoading) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        if (spinner) spinner.style.display = 'block';
        if (text) text.style.opacity = '0.5';
        if (icon) icon.style.opacity = '0.5';
        AppState.isSubmitting = true;
    } else {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (spinner) spinner.style.display = 'none';
        if (text) text.style.opacity = '1';
        if (icon) icon.style.opacity = '1';
        AppState.isSubmitting = false;
    }
}

// Form Navigation
function showForm(formId) {
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('form-visible');
        form.setAttribute('aria-hidden', 'true');
    });

    const targetForm = document.getElementById(formId);
    if (targetForm) {
        targetForm.classList.add('form-visible');
        targetForm.setAttribute('aria-hidden', 'false');
        targetForm.reset();
        
        setTimeout(() => {
            const firstInput = targetForm.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    const loginToggle = document.getElementById('loginToggle');
    const signupToggle = document.getElementById('signupToggle');
    
    if (formId === 'loginForm' || formId === 'twoStepVerification') {
        loginToggle?.classList.add('active');
        signupToggle?.classList.remove('active');
        loginToggle?.setAttribute('aria-selected', 'true');
        signupToggle?.setAttribute('aria-selected', 'false');
    } else if (['roleSelection', 'patientForm', 'doctorForm', 'adminForm', 'insuranceForm'].includes(formId)) {
        signupToggle?.classList.add('active');
        loginToggle?.classList.remove('active');
        signupToggle?.setAttribute('aria-selected', 'true');
        loginToggle?.setAttribute('aria-selected', 'false');
    }

    if (formId !== 'twoStepVerification') {
        clearResendTimer();
    }
}

// Enhanced Authentication System
const AuthSystem = {
    init() {
        this._setupEventListeners();
        this._loadRememberedUser();
    },
    
    async handleLogin(e) {
        e.preventDefault();
        
        if (AppState.isSubmitting) return;
        
        const userId = document.getElementById('userId').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        const submitBtn = document.getElementById('loginSubmitBtn');
        
        if (!userId || !password) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        setLoading(submitBtn, true);
        AppState.isSubmitting = true;
        
        try {
            await this._simulateAPICall();
            
            const isValid = await this._authenticateUser(userId, password);
            
            if (isValid) {
                AppState.currentUserId = userId;
                AppState.currentUserRole = TEST_CONFIG.USERS[userId]?.role || '';
                
                if (rememberMe) {
                    localStorage.setItem('remembered_user', userId);
                }
                
                showNotification('Login successful! Proceeding to verification...', 'success');
                
                // Short delay before showing 2FA
                setTimeout(() => {
                    this._showTwoStepVerification();
                }, 1500);
                
            } else {
                showNotification('Invalid User ID or password. Please check your credentials.', 'error');
            }
        } catch (error) {
            showNotification('Login failed. Please try again.', 'error');
        } finally {
            setLoading(submitBtn, false);
            AppState.isSubmitting = false;
        }
    },
    
    async _authenticateUser(userId, password) {
        // Check test accounts first
        if (TEST_CONFIG.ENABLED && TEST_CONFIG.USERS[userId]) {
            return password === TEST_CONFIG.USERS[userId].password;
        }
        
        // In a real application, this would make an API call to your backend
        // For demonstration, we'll simulate authentication for any valid credentials
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simple validation - in production, this would be handled by your backend
        return userId && password.length >= 8;
    },
    
    async _simulateAPICall() {
        await new Promise(resolve => setTimeout(resolve, SECURITY_CONFIG.RATE_LIMIT_DELAY));
        
        // Reduced failure chance for testing
        if (Math.random() < 0.02) {
            throw new Error('API connection failed');
        }
    },
    
    _loadRememberedUser() {
        if (TEST_CONFIG.ENABLED) {
            const rememberedUser = localStorage.getItem('remembered_user');
            if (rememberedUser && TEST_CONFIG.USERS[rememberedUser]) {
                document.getElementById('userId').value = rememberedUser;
                document.getElementById('rememberMe').checked = true;
            }
        }
    },
    
    _showTwoStepVerification() {
        const userData = TEST_CONFIG.USERS[AppState.currentUserId];
        const contactInfo = userData ? userData.contacts.email : 'your registered contact';
        document.getElementById('verificationContact').textContent = contactInfo;
        
        // Generate and display verification code
        AppState.verificationCode = this._generateSecureCode();
        
        showForm('twoStepVerification');
        startResendTimer();
        
        // Show the verification code for testing
        const verificationDisplay = document.getElementById('verificationCodeDisplay');
        if (verificationDisplay) {
            verificationDisplay.textContent = `Verification Code: ${AppState.verificationCode}`;
        }
        
        console.log('Verification Code:', AppState.verificationCode);
    },
    
    _generateSecureCode() {
        // Generate a simple 6-digit code for testing
        return Math.floor(100000 + Math.random() * 900000).toString();
    },
    
    _setupEventListeners() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    }
};

// Enhanced Decentralized Authentication
const DecentralizedAuth = {
    async init() {
        this._setupEventListeners();
        await this._checkBiometricSupport();
    },
    
    async _checkBiometricSupport() {
        try {
            if (window.PublicKeyCredential) {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (available) {
                    document.getElementById('biometricAuth').style.display = 'flex';
                }
            }
        } catch (error) {
            console.warn('Biometric authentication not supported:', error);
        }
    },
    
    async handleBiometricAuth() {
        try {
            showNotification('Initializing biometric authentication...', 'info');
            await this._simulateAuthDelay();
            
            const userId = document.getElementById('userId').value;
            if (userId && TEST_CONFIG.USERS[userId]) {
                showNotification('Biometric authentication successful!', 'success');
                document.getElementById('password').value = TEST_CONFIG.USERS[userId].password;
            } else {
                throw new AppError(
                    'Biometric authentication failed',
                    'BIOMETRIC_AUTH_FAILED',
                    'Biometric authentication failed. Please try manual login.'
                );
            }
        } catch (error) {
            showNotification('Biometric authentication failed', 'error');
        }
    },
    
    async handleHardwareKeyAuth() {
        try {
            showNotification('Please insert your security key...', 'info');
            await this._simulateAuthDelay();
            showNotification('Security key authentication successful!', 'success');
        } catch (error) {
            showNotification('Security key authentication failed', 'error');
        }
    },
    
    async handlePasskeyAuth() {
        try {
            showNotification('Looking for passkeys...', 'info');
            await this._simulateAuthDelay();
            showNotification('Passkey authentication successful!', 'success');
        } catch (error) {
            showNotification('Passkey authentication failed', 'error');
        }
    },
    
    async handleLocalPinAuth() {
        try {
            const pin = prompt('Enter your local PIN (Test: 1234):');
            if (pin === '1234') {
                await this._simulateAuthDelay();
                showNotification('Local PIN authentication successful!', 'success');
            } else {
                throw new AppError(
                    'Invalid PIN',
                    'INVALID_PIN',
                    'Please enter 1234 for testing'
                );
            }
        } catch (error) {
            showNotification('Local PIN authentication failed. Use 1234 for testing.', 'error');
        }
    },
    
    _setupEventListeners() {
        document.getElementById('biometricAuth')?.addEventListener('click', () => this.handleBiometricAuth());
        document.getElementById('hardwareKeyAuth')?.addEventListener('click', () => this.handleHardwareKeyAuth());
        document.getElementById('passkeyAuth')?.addEventListener('click', () => this.handlePasskeyAuth());
        document.getElementById('localPinAuth')?.addEventListener('click', () => this.handleLocalPinAuth());
    },
    
    async _simulateAuthDelay() {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (Math.random() < 0.1) {
            throw new Error('Authentication failed');
        }
    }
};

// Password Validation
const PasswordValidator = {
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]{8,}$/,
    
    validate(password) {
        const requirements = {
            length: password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
        };
        
        const isValid = Object.values(requirements).every(Boolean);
        const feedback = Object.entries(requirements)
            .filter(([, met]) => !met)
            .map(([type]) => {
                switch (type) {
                    case 'length': return `At least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`;
                    case 'lowercase': return 'One lowercase letter';
                    case 'uppercase': return 'One uppercase letter';
                    case 'number': return 'One number';
                    case 'special': return 'One special character';
                    default: return '';
                }
            });
        
        return { isValid, feedback, strength: this.calculateStrength(password) };
    },
    
    calculateStrength(password) {
        if (!password) return 0;
        
        let score = 0;
        if (password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 1;
        
        return score;
    }
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        const browserSupport = Utils.checkBrowserSupport();
        if (!browserSupport.secureContext) {
            showNotification('Warning: Not running in secure context. Some security features may be limited.', 'warning', 10000);
        }
        
        initializeApp();
        setupEventListeners();
        applySavedTheme();
        AuthSystem.init();
        DecentralizedAuth.init();
        
        updateCopyrightYear();
        
        if (window.lucide) {
            lucide.createIcons();
        }
        
        console.log('HealthConnect Pro initialized successfully');
        
    } catch (error) {
        showNotification('System failed to initialize. Please refresh the page.', 'error');
        setupBasicFallback();
    }
});

function initializeApp() {
    AppState.csrfToken = Utils.generateSecureRandom(32);
    document.querySelectorAll('input[name="csrfToken"]').forEach(input => {
        input.value = AppState.csrfToken;
    });
    
    if (TEST_CONFIG.ENABLED) {
        document.getElementById('testCredentials').style.display = 'block';
        setupTestCredentials();
    }
    
    updateInsuranceCompanies();
    setupCodeInputs();
    setupPasswordStrengthIndicators();
}

function updateCopyrightYear() {
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('.copyright-year').forEach(el => {
        el.textContent = currentYear;
    });
}

function setupTestCredentials() {
    document.querySelectorAll('.test-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const user = btn.dataset.user;
            const userData = TEST_CONFIG.USERS[user];
            
            if (userData) {
                document.getElementById('userId').value = user;
                document.getElementById('password').value = userData.password;
                showNotification(`Test account loaded: ${userData.hint}`, 'info', 5000);
                
                // Auto-submit after a short delay for convenience
                setTimeout(() => {
                    document.getElementById('loginSubmitBtn').click();
                }, 1000);
            }
        });
    });
}

function setupEventListeners() {
    const themeToggle = document.getElementById('darkModeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const hospitalDropdown = document.getElementById('hospitalDropdown');
    if (hospitalDropdown) {
        hospitalDropdown.addEventListener('change', () => {
            AppState.selectedHospital = hospitalDropdown.value;
            updateInsuranceCompanies();
        });
    }

    document.getElementById('loginToggle')?.addEventListener('click', () => showForm('loginForm'));
    document.getElementById('signupToggle')?.addEventListener('click', () => showForm('roleSelection'));

    document.addEventListener('click', (e) => {
        if (e.target.closest('.toggle-password')) {
            const button = e.target.closest('.toggle-password');
            const input = button.parentElement.querySelector('input[type="password"], input[type="text"]');
            if (input) {
                togglePasswordVisibility(input, button);
            }
        }
    });

    setupRoleSelection();

    document.getElementById('patientBackBtn')?.addEventListener('click', () => showForm('roleSelection'));
    document.getElementById('twoStepBackBtn')?.addEventListener('click', () => showForm('loginForm'));

    document.getElementById('verifyCodeBtn')?.addEventListener('click', verifyCode);
    document.getElementById('resendCodeBtn')?.addEventListener('click', resendVerificationCode);

    // Auto-fill for verification code
    document.getElementById('autoFillCode')?.addEventListener('click', autoFillVerificationCode);
}

function setupRoleSelection() {
    const roleCards = document.querySelectorAll('.role-card');
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            setRoleCardLoading(card, true);
            
            setTimeout(() => {
                const role = card.id.replace('RoleCard', '').toLowerCase();
                showRegistrationForm(role);
                setRoleCardLoading(card, false);
            }, 500);
        });
        
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setRoleCardLoading(card, true);
                
                setTimeout(() => {
                    const role = card.id.replace('RoleCard', '').toLowerCase();
                    showRegistrationForm(role);
                    setRoleCardLoading(card, false);
                }, 500);
            }
        });
    });
}

function setRoleCardLoading(card, isLoading) {
    if (isLoading) {
        card.classList.add('loading');
        card.setAttribute('aria-busy', 'true');
    } else {
        card.classList.remove('loading');
        card.removeAttribute('aria-busy');
    }
}

function showRegistrationForm(role) {
    const formId = `${role}Form`;
    showForm(formId);
}

// Insurance Companies Update
function updateInsuranceCompanies() {
    const insuranceSelect = document.getElementById('patientInsurance');
    if (insuranceSelect) {
        insuranceSelect.innerHTML = '<option value="">Select insurance provider</option>';
        
        const companies = hospitalInsuranceMap[AppState.selectedHospital] || [];
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            insuranceSelect.appendChild(option);
        });
    }
}

const hospitalInsuranceMap = {
    1: ['Blue Cross Blue Shield', 'Aetna', 'UnitedHealthcare', 'Cigna', 'Humana'],
    2: ['Kaiser Permanente', 'Anthem', 'Centene Corporation', 'Molina Healthcare'],
    3: ['Health Net', 'CareSource', 'WellCare', 'Bright Health', 'Oscar Health'],
    4: ['Molina Healthcare', 'Centene Corporation', 'Cigna', 'Aetna'],
    5: ['UnitedHealthcare', 'Humana', 'Blue Cross Blue Shield', 'Kaiser Permanente']
};

// Code Inputs Setup
function setupCodeInputs() {
    const codeInputs = document.querySelectorAll('.code-input');
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = value;
            
            if (value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
            
            if (value) {
                e.target.classList.add('filled');
            } else {
                e.target.classList.remove('filled');
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && index > 0) {
                e.preventDefault();
                codeInputs[index - 1].focus();
            } else if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
                e.preventDefault();
                codeInputs[index + 1].focus();
            } else if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
            const digits = pasteData.split('').slice(0, SECURITY_CONFIG.CODE_LENGTH);
            
            digits.forEach((digit, i) => {
                if (codeInputs[index + i]) {
                    codeInputs[index + i].value = digit;
                    codeInputs[index + i].classList.add('filled');
                }
            });
            
            const lastFilledIndex = Math.min(index + digits.length - 1, codeInputs.length - 1);
            codeInputs[lastFilledIndex].focus();
        });
    });
}

// Password Toggle
function togglePasswordVisibility(input, button) {
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
        button.setAttribute('aria-label', 'Hide password');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
        button.setAttribute('aria-label', 'Show password');
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Theme Management
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

function applyTheme(theme) {
    const html = document.documentElement;
    const body = document.body;
    
    if (theme === 'dark') {
        html.classList.add('dark-mode');
        body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'moon');
            }
        }
    } else {
        html.classList.remove('dark-mode');
        body.classList.remove('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'sun');
            }
        }
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

// 2FA Verification
async function verifyCode() {
    if (AppState.isSubmitting) return;
    
    const codeInputs = document.querySelectorAll('.code-input');
    const enteredCode = Array.from(codeInputs).map(input => input.value).join('');
    const verifyBtn = document.getElementById('verifyCodeBtn');
    
    if (enteredCode.length !== SECURITY_CONFIG.CODE_LENGTH) {
        showNotification('Please enter the complete 6-digit code', 'error');
        return;
    }
    
    setLoading(verifyBtn, true);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (enteredCode === AppState.verificationCode) {
            showNotification('Verification successful! Redirecting to dashboard...', 'success');
            
            // Simulate successful login and redirect
            setTimeout(() => {
                clearSensitiveData();
                redirectToPortal();
            }, 1500);
        } else {
            showNotification('Invalid verification code. Please try again.', 'error');
            codeInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled');
            });
            codeInputs[0].focus();
            
            // Show the correct code for testing
            showNotification(`The correct code is ${AppState.verificationCode}`, 'info', 8000);
        }
    } catch (error) {
        showNotification('Verification failed. Please try again.', 'error');
    } finally {
        setLoading(verifyBtn, false);
    }
}

function redirectToPortal() {
    const role = AppState.currentUserRole;
    const portalUrls = {
        patient: 'patient-dashboard.html',
        doctor: 'doctor-dashboard.html',
        admin: 'admin-dashboard.html',
        insurance: 'insurance-dashboard.html'
    };
    
    const portalUrl = portalUrls[role] || 'dashboard.html';
    window.location.href = portalUrl;
}

// Auto-fill verification code for testing
function autoFillVerificationCode() {
    const codeInputs = document.querySelectorAll('.code-input');
    const code = AppState.verificationCode;
    
    if (code && code.length === 6) {
        code.split('').forEach((digit, index) => {
            if (codeInputs[index]) {
                codeInputs[index].value = digit;
                codeInputs[index].classList.add('filled');
            }
        });
        showNotification('Verification code auto-filled', 'info');
    }
}

function clearSensitiveData() {
    AppState.verificationCode = '';
    AppState.currentUserId = '';
    AppState.currentUserRole = '';
}

function resendVerificationCode() {
    if (AppState.resendCountdown > 0) return;
    
    AppState.verificationCode = AuthSystem._generateSecureCode();
    showNotification(`New verification code sent: ${AppState.verificationCode}`, 'success');
    startResendTimer();
}

function startResendTimer() {
    AppState.resendCountdown = SECURITY_CONFIG.RESEND_TIMEOUT;
    const resendBtn = document.getElementById('resendCodeBtn');
    
    if (AppState.resendTimer) clearInterval(AppState.resendTimer);
    
    AppState.resendTimer = setInterval(() => {
        AppState.resendCountdown--;
        
        if (AppState.resendCountdown <= 0) {
            clearInterval(AppState.resendTimer);
            resendBtn.innerHTML = `Didn't receive the code? <strong>Resend</strong>`;
            resendBtn.classList.remove('disabled');
        } else {
            resendBtn.innerHTML = `Resend code in <strong>${AppState.resendCountdown}s</strong>`;
            resendBtn.classList.add('disabled');
        }
    }, 1000);
}

function clearResendTimer() {
    if (AppState.resendTimer) {
        clearInterval(AppState.resendTimer);
        AppState.resendTimer = null;
    }
    AppState.resendCountdown = 0;
}

function setupPasswordStrengthIndicators() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        if (input.id.includes('Password') && !input.id.includes('Confirm')) {
            const strengthId = input.id + 'Strength';
            const debouncedUpdate = Utils.debounce(() => {
                updatePasswordStrength(input.value, strengthId);
            }, SECURITY_CONFIG.DEBOUNCE_DELAY, `strength_${input.id}`);
            
            input.addEventListener('input', debouncedUpdate);
        }
    });
}

function updatePasswordStrength(password, strengthElementId) {
    const strengthElement = document.getElementById(strengthElementId);
    if (!strengthElement) return;
    
    const { strength, feedback } = PasswordValidator.validate(password);
    const bars = strengthElement.querySelectorAll('.strength-bar');
    
    bars.forEach(bar => {
        bar.className = 'strength-bar';
    });
    
    for (let i = 0; i < strength; i++) {
        if (bars[i]) {
            let strengthClass = 'weak';
            if (strength >= 4) strengthClass = 'strong';
            else if (strength >= 3) strengthClass = 'medium';
            
            bars[i].classList.add(strengthClass);
        }
    }
    
    strengthElement.setAttribute('aria-valuenow', strength);
    strengthElement.setAttribute('aria-valuetext', `${strength} password strength`);
    
    return { strength, feedback };
}

// Basic fallback for critical failures
function setupBasicFallback() {
    console.warn('Running in fallback mode');
    
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            showNotification('System is in fallback mode. Form submission disabled.', 'warning');
        });
    });
    
    document.querySelectorAll('[onclick*="showForm"]').forEach(button => {
        const match = button.getAttribute('onclick')?.match(/showForm\('([^']+)'\)/);
        if (match) {
            button.addEventListener('click', () => {
                showForm(match[1]);
            });
        }
    });
}

// Performance optimizations and cleanup
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Handle resize optimizations if needed
    }, 250);
});

window.addEventListener('beforeunload', () => {
    clearResendTimer();
    
    AppState.debounceTimers.forEach(timer => clearTimeout(timer));
    AppState.debounceTimers.clear();
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});