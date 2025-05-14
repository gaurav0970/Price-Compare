document.addEventListener('DOMContentLoaded', function() {
    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Client-side validation
            if (!email || !password) {
                showError('Please fill in all fields');
                return;
            }
            
            // Send login request to server
            loginUser(email, password);
        });
    }
    
    // Handle signup form submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Client-side validation
            if (!name || !email || !password || !confirmPassword) {
                showError('Please fill in all fields');
                return;
            }
            
            if (password !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }
            
            // Send signup request to server
            registerUser(name, email, password);
        });
    }
});

function showError(message) {
    const errorElement = document.getElementById('authError');
    errorElement.textContent = message;
    setTimeout(() => {
        errorElement.textContent = '';
    }, 5000);
}

// API Calls
async function loginUser(email, password) {
    try {
      console.log('Attempting login with:', { email }); // Debug log
      
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), // Trim whitespace
          password 
        })
      });
  
      console.log('Login response status:', response.status); // Debug log
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
  
      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Login error details:', error); // Detailed log
      showError(error.message.includes('Not found') 
        ? 'User not found. Please check your email.'
        : error.message
      );
    }
  }

async function registerUser(name, email, password) {
    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
  
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'dashboard.html'; // Redirect after signup
      } else {
        throw new Error(data.message || 'Signup failed');
      }
    } catch (error) {
      document.getElementById('authError').textContent = error.message;
    }
  }