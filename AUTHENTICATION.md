# RepoCHief CLI Authentication Guide

## Prerequisites

RepoCHief CLI requires a dashboard account for authentication. This ensures secure workspace management and device authorization.

## Account Setup

### 1. Create Your Account

Before using the CLI, you must have a RepoCHief dashboard account:

1. Visit https://app.repochief.com/sign-up
2. Create your account using email or social login
3. Complete the onboarding process
4. You'll be redirected to your dashboard

### 2. Authenticate the CLI

Once you have an account, you can authenticate the CLI:

```bash
repochief auth login
```

This will:
1. Display a device code (e.g., `ABCD-1234`)
2. Provide a URL to visit (https://app.repochief.com/device)
3. Open your browser automatically (unless disabled with `--no-browser`)

### 3. Authorize Your Device

In your browser:
1. **Sign in** to your dashboard account (if not already signed in)
2. **Enter the code** displayed in your terminal
3. **Click "Authorize"** to link the CLI to your workspace

The CLI will automatically detect the authorization and complete the setup.

## Why Account is Required

The dashboard account requirement provides several benefits:

- **Secure Device Management**: Track and manage all devices accessing your workspace
- **Workspace Synchronization**: Seamlessly sync data between CLI and dashboard
- **Access Control**: Revoke device access anytime from the dashboard
- **Usage Tracking**: Monitor API usage and costs across all devices
- **Team Collaboration**: Share workspaces with team members (coming soon)

## Alternative: Personal Access Tokens

For CI/CD environments or advanced users, you can use Personal Access Tokens:

1. Generate a PAT from https://app.repochief.com/settings/tokens
2. Use it with the CLI:

```bash
repochief auth login --token rcp_xxxxxxxxxxxxxxxx
```

Or set as environment variable:
```bash
export REPOCHIEF_TOKEN="rcp_xxxxxxxxxxxxxxxx"
repochief run tasks/example.json
```

## Multi-Device Usage

Your account supports multiple devices:

```bash
# Check all connected devices
repochief auth status --verbose

# Logout from current device
repochief auth logout

# Logout from all devices
repochief auth logout --all-devices
```

## Troubleshooting

### "You must be logged in to authorize devices"

This error means you need to sign in to your dashboard account first:
1. Click "Sign in to your account" link in the error message
2. Sign in with your credentials
3. Return to the device page and enter your code again

### "Invalid or expired device code"

Device codes expire after 15 minutes. If you see this error:
1. Return to your terminal
2. Run `repochief auth login` again to get a new code
3. Complete the authorization promptly

### "Failed to authorize device"

Generic authorization failures can occur due to:
- Network connectivity issues
- Expired tokens
- Server maintenance

Try again in a few moments, or check https://status.repochief.com

## Security Notes

- **Tokens are encrypted**: The CLI stores tokens using AES-256-GCM encryption
- **Machine-specific keys**: Each device has unique encryption keys
- **Automatic refresh**: Tokens refresh automatically before expiry
- **Secure transmission**: All API calls use HTTPS

## Support

If you continue experiencing issues:
- Check our documentation: https://docs.repochief.com
- Visit our support portal: https://support.repochief.com
- Email us: support@repochief.com

## Future Enhancements

We're considering these improvements for future releases:
- Guest access for CLI-only users (evaluation mode)
- SSO integration for enterprise accounts
- Biometric authentication support
- Hardware security key support