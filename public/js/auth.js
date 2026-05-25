/**
 * Authentication Module
 * Handles user login/logout flows and form interactions
 */

// DOM elements
const loginBtn = document.getElementById('btn-login');
const loginForm = document.getElementById('login-form');
const loginFormCloseBtn = loginForm.querySelector('.login-btn-close');
const loginFormSubmit = loginForm.querySelector('.login-btn-submit');
const adminBtns = document.getElementById('adminBtns');
const logoutBtn = document.getElementById('btn-logout');
const updateBtn = document.getElementById('btn-update');
const createBtn = document.getElementById('btn-create');
const updateWarning = document.getElementById('update-warning');
// Initialize auth event listeners
function initAuth() {
    // Show login form when login button is clicked
    loginBtn.addEventListener('click', () => {
        loginForm.classList.remove('hidden');
        // Focus on email input for better UX
        document.getElementById('email').focus();
    });

    // Close login form when close button is clicked
    loginFormCloseBtn.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        clearLoginForm();
    });

    // Handle login form submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
    });

    //   // Handle logout
    //   logoutBtn.addEventListener('click', () => {
    //     handleLogout();
    //   });
}

/**
 * Handle login form submission
 * Currently just closes the form and reveals admin buttons
 */
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginData = {email, password}
    const response = await fetch('/login', {
        method: 'POST', // Specify the HTTP 
        headers: {
            'Content-Type': 'application/json' // Tell the server we are sending JSON  
        },
        body: JSON.stringify(loginData)
    })
    if (response.status === 200) {
        loginForm.classList.add('hidden');
        //   loginBtn.style.display = 'none';
        loginBtn.innerHTML = 'Logout'
    
        updateBtn.style.display = '';
        updateWarning.style.display = '';
        createBtn.style.display = '';
        clearLoginForm();
        
    } else {
        alert('Bad login');
        
    }
}

/**
 * Handle logout
 * Resets UI to logged-out state
 */
function handleLogout() {
    // TODO: Add logout logic (clear session, tokens, etc.)
    console.log('User logged out');

    // Reset UI
    adminBtns.style.display = 'none';
    loginBtn.style.display = 'block';
    updateBtn.style.display = 'none';
    updateWarning.style.display = 'none';
    createBtn.style.display = 'none';
    clearLoginForm();
}

/**
 * Clear login form fields
 */
function clearLoginForm() {
    loginForm.reset();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAuth);