export const authTemplates = {
  verificationEmail: (url: string, name: string): string => `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        background-color: #f4f7f6;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background-color: #0074BA;
        color: #ffffff;
        padding: 20px;
        text-align: center;
      }
      .email-body {
        padding: 30px;
        color: #333333;
        line-height: 1.6;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        margin-top: 20px;
        background-color: #f57c00;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
      }
      .email-footer {
        background-color: #f1f1f1;
        color: #777777;
        padding: 15px;
        text-align: center;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h2>Welcome to the System</h2>
      </div>
      <div class="email-body">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering on our platform. To ensure account security and protect against SPAM, we need you to confirm your email address.</p>
        <p>Please click the button below to verify your account:</p>
        <div style="text-align: center;">
          <a href="${url}" class="btn">Verify My Account</a>
        </div>
        <p style="margin-top: 30px; font-size: 13px; color: #666;">If you didn't create this account, you can safely ignore this email.</p>
      </div>
      <div class="email-footer">
        &copy; ${new Date().getFullYear()} IoT System. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `,
  verificationResponse: (success: boolean, message: string, loginUrl: string): string => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        font-family: 'Inter', sans-serif;
        background-color: #2A3447;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        background-color: #333F54;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        text-align: center;
        max-width: 400px;
        width: 100%;
        color: #E0E0E0;
      }
      .icon {
        font-size: 64px;
        margin-bottom: 20px;
        font-family: 'Inter', sans-serif;
      }
      .success-icon { color: #13DEB9; }
      .error-icon { color: #FA896B; }
      h2 {
        color: #FFFFFF;
        margin-top: 0;
        margin-bottom: 10px;
        font-weight: 700;
        font-size: 24px;
      }
      p {
        color: #A0AABF;
        line-height: 1.5;
        margin-bottom: 30px;
        font-size: 15px;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        background-color: #0074BA;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        transition: background-color 0.3s;
        width: 80%;
      }
      .btn:hover {
        background-color: #005a91;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon ${success ? 'success-icon' : 'error-icon'}">
        ${success ? '&#10004;' : '&#10006;'}
      </div>
      <h2>${success ? 'Verification Successful' : 'Verification Failed'}</h2>
      <p>${message}</p>
      <a href="${loginUrl}" class="btn">Go to Login</a>
    </div>
  </body>
  </html>
  `,
  passwordResetEmail: (url: string, name: string): string => `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        background-color: #f4f7f6;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background-color: #0074BA;
        color: #ffffff;
        padding: 20px;
        text-align: center;
      }
      .email-body {
        padding: 30px;
        color: #333333;
        line-height: 1.6;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        margin-top: 20px;
        background-color: #f57c00;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
      }
      .email-footer {
        background-color: #f1f1f1;
        color: #777777;
        padding: 15px;
        text-align: center;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h2>Password Reset Request</h2>
      </div>
      <div class="email-body">
        <p>Hello <strong>${name}</strong>,</p>
        <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
        <p>To reset your password, click the button below:</p>
        <div style="text-align: center;">
          <a href="${url}" class="btn">Reset My Password</a>
        </div>
        <p style="margin-top: 30px; font-size: 13px; color: #666;">This link will expire soon for security reasons.</p>
      </div>
      <div class="email-footer">
        &copy; ${new Date().getFullYear()} IoT System. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `,
  passwordResetForm: (token: string, user: string): string => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        font-family: 'Inter', sans-serif;
        background-color: #2A3447;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        color: #E0E0E0;
      }
      .card {
        background-color: #333F54;
        padding: 30px 40px;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        max-width: 480px;
        width: 100%;
        box-sizing: border-box;
      }
      h2 {
        color: #FFFFFF;
        margin-top: 0;
        margin-bottom: 8px;
        font-weight: 700;
        font-size: 28px;
        text-align: left;
      }
      p {
        color: #A0AABF;
        line-height: 1.5;
        margin-bottom: 32px;
        font-size: 15px;
        text-align: left;
      }
      .form-group {
        margin-bottom: 24px;
      }
      label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #E0E0E0;
      }
      input[type="password"], input[type="text"] {
        width: 100%;
        padding: 14px 44px 14px 16px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background-color: transparent;
        color: #FFFFFF;
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        box-sizing: border-box;
        transition: border-color 0.3s;
      }
      input:focus {
        outline: none;
        border-color: #0074BA;
      }
      .input-container {
        position: relative;
        display: flex;
        align-items: center;
      }
      .toggle-password {
        position: absolute;
        right: 14px;
        cursor: pointer;
        color: #A0AABF;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.3s;
      }
      .toggle-password:hover {
        color: #FFFFFF;
      }
      .toggle-password svg {
        width: 20px;
        height: 20px;
      }
      .error-msg {
        color: #FA896B;
        font-size: 12px;
        margin-top: 8px;
        display: none;
        line-height: 1.4;
      }
      .btn {
        display: block;
        width: 100%;
        padding: 14px;
        margin-top: 24px;
        background-color: #0074BA;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: opacity 0.3s;
        font-family: 'Inter', sans-serif;
        text-transform: none;
      }
      .btn:hover {
        opacity: 0.9;
      }
      .btn:disabled {
        background-color: #4B5A73;
        cursor: not-allowed;
        opacity: 0.6;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Create New Password</h2>
      <p>Resetting password for <strong>${user}</strong></p>
      
      <form id="resetForm" action="./reset-password" method="POST">
        <input type="hidden" name="token" value="${token}">
        
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <div class="input-container">
            <input type="password" id="newPassword" name="newPassword" required placeholder="Enter new password">
            <span class="toggle-password" onclick="toggleVisibility('newPassword')">
              <svg id="eye-newPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </span>
          </div>
          <div id="passwordError" class="error-msg">Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character.</div>
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <div class="input-container">
            <input type="password" id="confirmPassword" name="confirmPassword" required placeholder="Confirm new password">
            <span class="toggle-password" onclick="toggleVisibility('confirmPassword')">
              <svg id="eye-confirmPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </span>
          </div>
          <div id="matchError" class="error-msg">Passwords do not match.</div>
        </div>
        
        <button type="submit" id="submitBtn" class="btn">Reset Password</button>
      </form>
    </div>

    <script>
      const newPassword = document.getElementById('newPassword');
      const confirmPassword = document.getElementById('confirmPassword');
      const passwordError = document.getElementById('passwordError');
      const matchError = document.getElementById('matchError');
      const submitBtn = document.getElementById('submitBtn');
      const form = document.getElementById('resetForm');

      // Icons
      const eyeOpen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      const eyeClosed = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

      function toggleVisibility(inputId) {
        const input = document.getElementById(inputId);
        const toggleSpan = input.nextElementSibling;
        if (input.type === 'password') {
          input.type = 'text';
          toggleSpan.innerHTML = eyeClosed;
        } else {
          input.type = 'password';
          toggleSpan.innerHTML = eyeOpen;
        }
      }

      // Secure Regex Matching (at least 8 chars, 1 upper, 1 lower, 1 number, 1 special)
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

      function validate() {
        let isValid = true;
        
        if (newPassword.value.length > 0 && !regex.test(newPassword.value)) {
          passwordError.style.display = 'block';
          isValid = false;
        } else {
          passwordError.style.display = 'none';
        }

        if (confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value) {
          matchError.style.display = 'block';
          isValid = false;
        } else {
          matchError.style.display = 'none';
        }
        
        if(newPassword.value.length === 0 || confirmPassword.value.length === 0) {
            isValid = false;
        }

        submitBtn.disabled = !isValid;
      }

      newPassword.addEventListener('input', validate);
      confirmPassword.addEventListener('input', validate);
      
      form.addEventListener('submit', function(e) {
         if(!regex.test(newPassword.value) || newPassword.value !== confirmPassword.value) {
             e.preventDefault();
         } 
      });
      validate();
    </script>
  </body>
  </html>
  `,
  passwordResetResponse: (success: boolean, message: string, loginUrl: string): string => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        font-family: 'Inter', sans-serif;
        background-color: #2A3447;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        background-color: #333F54;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        text-align: center;
        max-width: 400px;
        width: 100%;
        color: #E0E0E0;
      }
      .icon {
        font-size: 64px;
        margin-bottom: 20px;
        font-family: 'Inter', sans-serif;
      }
      .success-icon { color: #13DEB9; }
      .error-icon { color: #FA896B; }
      h2 {
        color: #FFFFFF;
        margin-top: 0;
        margin-bottom: 10px;
        font-weight: 700;
        font-size: 24px;
      }
      p {
        color: #A0AABF;
        line-height: 1.5;
        margin-bottom: 30px;
        font-size: 15px;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        background-color: #0074BA;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        transition: background-color 0.3s;
        width: 80%;
      }
      .btn:hover {
        background-color: #005a91;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon ${success ? 'success-icon' : 'error-icon'}">
        ${success ? '&#10004;' : '&#10006;'}
      </div>
      <h2>${success ? 'Password Reset Successful' : 'Password Reset Failed'}</h2>
      <p>${message}</p>
      <a href="${loginUrl}" class="btn">Go to Login</a>
    </div>
  </body>
  </html>
  `,

  /**
   * @description Plantilla para el código de segundo factor (2FA).
   * @param {string} code Código de 6 dígitos.
   * @param {string} user Nombre del usuario.
   */
  twoFactorCodeEmail: (code: string, user: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        background-color: #f4f7f6;
        margin: 0;
        padding: 0;
      }
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .email-header {
        background-color: #0074BA;
        color: #ffffff;
        padding: 20px;
        text-align: center;
      }
      .email-body {
        padding: 30px;
        color: #333333;
        line-height: 1.6;
        text-align: center;
      }
      .code-display {
        font-size: 32px;
        font-weight: bold;
        color: #0074BA;
        letter-spacing: 5px;
        margin: 20px 0;
        padding: 15px;
        background-color: #f8f9fa;
        border: 1px dashed #0074BA;
        border-radius: 4px;
        display: inline-block;
      }
      .email-footer {
        background-color: #f1f1f1;
        color: #777777;
        padding: 15px;
        text-align: center;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h2 style="margin: 0;">Security Verification</h2>
      </div>
      <div class="email-body">
        <p>Hello <strong>${user}</strong>,</p>
        <p>Your account is protected by Two-Step Verification. Please use the following code to complete your login:</p>
        <div class="code-display">${code}</div>
        <p style="margin-top: 20px; font-size: 14px;">This code is valid for <strong>15 minutes</strong>.</p>
        <p style="margin-top: 30px; font-size: 13px; color: #666;">If you did not attempt to login, please secure your account immediately.</p>
      </div>
      <div class="email-footer">
        &copy; ${new Date().getFullYear()} Irrigation System. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `
};
