# Data Collection Summary - Email Authentication System

**Last Updated**: February 5, 2026  
**System**: GLKB Backend - Email Authentication Module

---

## Overview

The GLKB backend uses a **passwordless login system**. Instead of passwords, you log in by entering a code sent to your email. This document explains what information we collect and store.

---

## What Information We Collect

### 1. Your Account Information
When you create an account, we store:
- **Email address** - Used to send login codes and identify your account
- **Username** - Your display name
- **Account status** - Whether your account is active and verified
- **Timestamps** - When you created your account, updated your profile, and last logged in

This information is kept until you delete your account.

### 2. Login Security Information
When you request a login code, we keep track of:
- **Your email address** - To know where to send the code
- **IP address** - The internet address you're connecting from (helps prevent abuse)
- **Verification code activity** - When codes were created and expire (codes are securely encrypted and expire after 10 minutes)
- **Login attempts** - How many times you tried entering the code (limited to 5 attempts per code)

### 3. Abuse Prevention
To protect the system from spam and attacks, we track:
- **Request counts I** - How many times you've requested a login code using the same email address (limited to 5 per hour)
- **Request counts II** - How many times you've requested a login code using the same ip address (limited to 10 per hour)

### 4. Login Sessions
When you successfully log in:
- You receive a temporary access token that expires after 24 hours
- This token is stored on your device, not in our database
- It contains your user ID and email address

### 5. Email Communications
When we send you a login code via email:
- The email contains a 6-digit code valid for 10 minutes
- Our email service provider (e.g., Gmail, SendGrid) handles delivery
- They may collect delivery information according to their own policies

---

## What's Stored on Your Device (Browser)

When you log in, some information is saved directly on your device in your web browser:

### Browser Storage
- **Login token** - A special key that proves you're logged in (expires after 24 hours)
- **Your profile info** - Your username and email address for quick access
- **Token type** - Technical information about how your login key works

This information:
- ✓ Stays only on your device
- ✓ Is not accessible to other websites
- ✓ Is automatically deleted when you log out
- ✓ Gets cleared if your login expires (after 24 hours)
- ✓ Can be manually deleted by clearing your browser data

---

## What We DON'T Collect

We keep our data collection minimal. We do **NOT** collect or store:

- ❌ **Passwords** - Our system doesn't use passwords at all
- ❌ **Device information** - We don't track what device or browser you use
- ❌ **Location data** - We only see your IP address, not your physical location
- ❌ **Tracking cookies** - We don't use cookies to track your activity across websites
- ❌ **Browsing history** - We don't see what other websites you visit
- ❌ **Social media information** - We don't connect to or collect data from social media accounts
- ❌ **Biometric data** - No fingerprints, face scans, or similar data
- ❌ **Personal documents or files** - We only work with the data you explicitly submit

---

## Security Measures

We take security seriously:
- **No password storage** - Since we don't use passwords, they can't be stolen
- **Encrypted codes** - Verification codes are encrypted before being stored
- **Time limits** - Login codes expire after 10 minutes
- **Attempt limits** - You can only try entering a code 5 times
- **Rate limiting** - Prevents spam by limiting code requests to 5 per hour
- **Secure connections** - All data is transmitted over encrypted connections (HTTPS)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-05 | Initial documentation |
