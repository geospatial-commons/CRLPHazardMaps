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
const userInfo = document.getElementById('user-info');
//const logoutBtn = document.getElementById('btn-logout'); // logout button does not exist in the HTML, so this is commented out for now
const updateBtn = document.getElementById('btn-update');
const createBtn = document.getElementById('btn-create');
const updateWarning = document.getElementById('update-warning');
// Initialize auth event listeners
function initAuth() {
    // Show login form when login button is clicked
    loginBtn.addEventListener('click', () => {
        if (loginBtn.innerHTML === 'Logout') {
            handleLogout();
            return;
        } else {
            loginForm.classList.remove('hidden');
            // Focus on email input for better UX
            document.getElementById('email').focus();
        }
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

    // Handle logout
    /*logoutBtn.addEventListener('click', () => { // logoutBtn doesn't exist in the current HTML, so this is commented out for now
        handleLogout();
    });*/
    checkAuthOnLoad();
}

/**
 * Handle login form submission
 * Currently just closes the form and reveals admin buttons
 */
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginData = { email, password }
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
        loginBtn.innerHTML = 'Logout';
        userInfo.innerHTML = `Logged in as:<br>${email}`; // Display logged-in user's email

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
async function handleLogout() {
    // TODO: Add logout logic (clear session, tokens, etc.)
    console.log('User logged out');

    fetch('/logout', {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if (response.status === 200) {
            console.log('Logout successful');
            window.location.reload(); // Reload the page to update the UI
        } else {
            console.log('Logout failed');
        }
    }).catch(error => {
        console.error('Error during logout:', error);
    });
    // Reset UI
    loginBtn.innerHTML = 'Login';
    userInfo.innerHTML = ''; // Clear user info
    updateBtn.style.display = 'none';
    updateWarning.style.display = 'none';
    createBtn.style.display = 'none';   
}

/**
 * Clear login form fields
 */
function clearLoginForm() {
    loginForm.reset();
}


function checkAuthOnLoad() {
    fetch('/api/user', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.status === 200) {
            
            return response.json();
        } else {
            // if jwt not present or bad jwt
            // throw new Error('Not authenticated');
        }
    })
    .then(data => {
         // Assuming the response contains the user's email
        const email = data.email;
        userInfo.innerHTML = `Logged in as:<br>${email}`; // Display logged-in user's email
        loginForm.classList.add('hidden');
        //   loginBtn.style.display = 'none';
        loginBtn.innerHTML = 'Logout';

        updateBtn.style.display = '';
        updateWarning.style.display = '';
        createBtn.style.display = '';
    })
    .catch(error => {
        console.error('Error checking authentication:', error);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAuth);