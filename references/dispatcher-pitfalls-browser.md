# Browser / GUI Access Restrictions and Capabilities

## X11/Desktop Reachability (Computer Use)
- X11 is functional (`DISPLAY=:1`, `XDG_SESSION_TYPE=x11`) and accessible via `computer_use`.
- **Known Issue (Blank Screen):** When the desktop is locked or in screen blanking mode (idle), `computer_use(action='capture', mode='vision')` will return a completely black image (0 interactable elements, no applications).
- **Attempted Workarounds:** Attempting to wake the screen via terminal commands (`xset s off -dpms`, `gsettings set org.gnome.desktop.session idle-delay 0`) or simulating mouse movement does not successfully unlock or wake the session if it's deeply locked or if a remote desktop connection (like XRDP/RustDesk) has been minimized/disconnected.
- **Resolution:** The user MUST manually wake/unlock the display by logging in or reconnecting their remote desktop client before `computer_use` can capture the UI or interact with applications like Firefox.

## Browser_Navigate Restrictions
- **Cloudflare/Bot Detection:** Navigating to certain sites (e.g., `https://chatgpt.com`) using the headless `browser_navigate` tool will be blocked by Cloudflare (resulting in a "Just a moment..." page or bot detection warnings).
- **Alternative:** Use desktop Firefox via `computer_use` instead, provided the desktop is unlocked (see above).