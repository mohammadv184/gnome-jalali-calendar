<p align="center">
  <img alt="Jalali Calendar Logo" src="assets/logo.png" height="150" />
  <h3 align="center">GNOME Jalali Calendar</h3>
  <p align="center">A native and feature-rich persian Jalali (Shamsi) calendar extension for GNOME Shell.</p>
</p>

<p align="center">
  <a href="https://extensions.gnome.org/extension/XXXX/jalali-calendar/"><img src="https://img.shields.io/badge/GNOME%20Shell-Extension-blue.svg?style=flat-square" alt="GNOME Shell Extension"></a>
  <a href="https://github.com/mohammadv184/gnome-jalali-calendar/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mohammadv184/gnome-jalali-calendar?style=flat-square" alt="License"></a>
</p>

---

![Screenshot](./assets/screenshot.png)

A extension that natively integrates the Iranian Jalali calendar directly into your GNOME Shell desktop environment, replacing the standard date menu with it.


## Installation

### Method 1: GNOME Extensions (Recommended)

The easiest way to install is directly from the official GNOME Extensions website.



1. Go to the **GNOME Extensions page**: 
[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">](https://extensions.gnome.org/extension/10252/jalali-calendar/)
--- Or ---
https://extensions.gnome.org/extension/10252/jalali-calendar/

3. Click the toggle switch to turn it **ON**.
4. Accept the installation prompt.

*(Note: If you haven't set up GNOME Extensions before, you may need to install the `gnome-browser-connector` package for your distribution).*

### Method 2: Using GNOME Extensions CLI

If you downloaded the built `.zip` file from the Releases page, you can install and enable it using GNOME's built-in tool:

```bash
gnome-extensions install jalali-calendar@mohammad-abbasi.me.zip
gnome-extensions enable jalali-calendar@mohammad-abbasi.me
```

### Method 3: Using Make (From Source)

1. Clone this repository:
```bash
git clone https://github.com/mohammadv184/gnome-jalali-calendar.git
cd gnome-jalali-calendar
```

2. Run the install command:
```bash
make install
```

3. Restart GNOME Shell (Press `Alt+F2`, type `r`, and hit `Enter`, or log out and log back in on Wayland).
4. Enable the extension using the "Extensions" app.

## Configuration

Once installed, you can configure the extension through the official **GNOME Extensions** app:
1. Open the **Extensions** app.
2. Locate **Jalali Calendar** in the list.
3. Click the **Settings** button next to it.
4. Customize your colors, fonts, and etc.
## Contributing

Contributions are welcome! Please open issues or pull requests for improvements or bug fixes.

## Security

If you discover any security-related issues, please email mohammad.v184@gmail.com instead of using the issue tracker.

## License

Please see the [LICENSE](LICENSE) file for details.