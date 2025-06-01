import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Create a transporter object using SMTP transport
// You MUST configure these environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
  secure: parseInt(process.env.EMAIL_SERVER_PORT || "587") === 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_USER, // Your SMTP username
    pass: process.env.EMAIL_SERVER_PASSWORD, // Your SMTP password or app password
  },
  // Optional: If you're using a self-signed certificate or encounter TLS issues locally
  // tls: {
  //   rejectUnauthorized: process.env.NODE_ENV === 'production', // Enforce in prod, relax for dev if needed
  // },
});

/**
 * Sends an email using the pre-configured transporter.
 * @param mailOptions Options for the email (to, subject, text, html).
 */
async function sendEmail(mailOptions: MailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"Your App Name" <${process.env.EMAIL_FROM}>`, // Sender address (must be configured in your .env)
      ...mailOptions,
    });
    console.log('Email sent successfully to:', mailOptions.to);
  } catch (error) {
    console.error('Error sending email:', error);
    // Depending on your error handling strategy, you might want to throw the error
    // or handle it in a way that the calling function is aware of the failure.
    throw new Error(`Failed to send email to ${mailOptions.to}.`);
  }
}

/**
 * Sends a password reset email to the user.
 * @param email The recipient's email address.
 * @param resetLink The password reset link to include in the email.
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const subject = 'Reset Your Password';
  const textContent = `Hello,\n\nPlease click the following link to reset your password: ${resetLink}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nYour App Team`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset the password for your account. Please click the button below to choose a new password:</p>
      <p style="text-align: center;">
        <a 
          href="${resetLink}" 
          target="_blank" 
          style="display: inline-block; padding: 12px 25px; margin: 20px 0; font-size: 16px; color: #ffffff; background-color: #007bff; text-decoration: none; border-radius: 5px;"
        >
          Reset Your Password
        </a>
      </p>
      <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
      <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>Thanks,<br/>The Your App Name Team</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: subject,
    text: textContent,
    html: htmlContent,
  });
}

// You can add other email sending functions here, e.g., for email verification, welcome emails, etc. 